import re
import time
from unittest.mock import patch

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, override_settings
from google.auth.exceptions import TransportError

from .models import AuthIdentity, Profile, User
from .services import AccountError, verify_google_credential


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AccountAPITests(TestCase):
    password = "Milestone1-test-password!"

    def setUp(self):
        cache.clear()
        self.client = Client(enforce_csrf_checks=True)

    def write(self, path, data, method="post", client=None):
        client = client or self.client
        csrf = client.get("/api/auth/csrf/").json()["csrf_token"]
        return getattr(client, method)(path, data, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)

    def register(self, email="one@example.com"):
        response = self.write("/api/auth/register/", {"email": email, "password": self.password})
        self.assertEqual(response.status_code, 201, response.content)
        return response

    def test_register_creates_owned_profile_and_rotates_session(self):
        response = self.register("One@Example.com")
        user = User.objects.get(email="one@example.com")
        self.assertEqual(response.json()["profile"]["user_id"], str(user.pk))
        self.assertEqual(response.json()["profile"]["revision"], 1)
        self.assertEqual(self.client.get("/api/auth/me/").json()["user"]["id"], str(user.pk))
        self.assertTrue(user.check_password(self.password))
        self.assertNotIn("password", response.json()["user"])
        self.assertIn("no-store", response.headers["Cache-Control"])

    def test_profile_creation_failure_rolls_back_user(self):
        with patch("accounts.models.Profile.objects.using") as manager:
            manager.return_value.create.side_effect = RuntimeError("profile failure")
            with self.assertRaises(RuntimeError):
                User.objects.create_user("rollback@example.com", self.password)
        self.assertFalse(User.objects.filter(email="rollback@example.com").exists())

    def test_public_auth_writes_require_csrf(self):
        for path, data in [("register", {"email": "bad@example.com", "password": self.password}), ("login", {"email": "bad@example.com", "password": self.password}), ("password-reset", {"email": "bad@example.com"})]:
            response = self.client.post(f"/api/auth/{path}/", data, content_type="application/json")
            self.assertEqual(response.status_code, 403)
        self.assertEqual(User.objects.count(), 0)

    def test_weak_password_and_unknown_privilege_fields_rejected(self):
        self.assertEqual(self.write("/api/auth/register/", {"email": "a@example.com", "password": "password"}).status_code, 400)
        self.assertEqual(self.write("/api/auth/register/", {"email": "a@example.com", "password": self.password, "is_catalog_admin": True}).status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_credential_rate_limit_does_not_block_csrf_bootstrap(self):
        with patch("rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES", {"auth": "2/min", "profile": "120/min", "password_reset": "10/hour"}):
            payload = {"email": "missing@example.com", "password": "wrong"}
            self.assertEqual(self.write("/api/auth/login/", payload).status_code, 401)
            self.assertEqual(self.write("/api/auth/login/", payload).status_code, 401)
            self.assertEqual(self.write("/api/auth/login/", payload).status_code, 429)
            self.assertEqual(self.client.get("/api/auth/csrf/").status_code, 200)

    def test_duplicate_email_and_failed_login_do_not_create_session(self):
        User.objects.create_user("one@example.com", self.password)
        response = self.write("/api/auth/register/", {"email": "ONE@example.com", "password": self.password})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.write("/api/auth/login/", {"email": "one@example.com", "password": "wrong"}).status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)

    def test_logout_and_account_switch_do_not_reveal_previous_profile(self):
        first = self.register().json()
        self.assertEqual(self.write("/api/profile/", {"revision": 1, "display_name": "Private One"}, "patch").status_code, 200)
        self.assertEqual(self.write("/api/auth/logout/", {}).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)
        self.assertEqual(self.client.get("/api/profile/").status_code, 403)
        self.register("two@example.com")
        current = self.client.get("/api/auth/me/").json()
        self.assertNotEqual(current["user"]["id"], first["user"]["id"])
        self.assertEqual(current["profile"]["display_name"], "")
        self.assertNotIn("Private One", str(current))

    def test_profile_validation_revision_conflicts_and_owner_boundary(self):
        self.register()
        other = User.objects.create_user("other@example.com", self.password)
        invalid = [{"timezone": "not/a/zone"}, {"height_cm": "0"}, {"goal": "maintenance"}, {"weight_unit": "stone"}, {"language": "fr"}, {"user_id": str(other.pk)}]
        for changes in invalid:
            self.assertEqual(self.write("/api/profile/", {"revision": 1, **changes}, "patch").status_code, 400)
        self.assertEqual(self.write("/api/profile/", {"display_name": "Name"}, "patch").status_code, 400)
        response = self.write("/api/profile/", {"revision": 1, "display_name": "أحمد", "timezone": "Africa/Cairo", "height_cm": "180.500", "language": "ar", "goal": "bulking", "weight_unit": "lb"}, "patch")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["revision"], 2)
        stale = self.write("/api/profile/", {"revision": 1, "display_name": "Stale"}, "patch")
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()["profile"]["display_name"], "أحمد")
        self.assertEqual(self.client.get(f"/api/profile/?user_id={other.pk}").json()["display_name"], "أحمد")
        other.profile.refresh_from_db()
        self.assertEqual(other.profile.display_name, "")

    def test_database_enforces_profile_height(self):
        user = User.objects.create_user("height@example.com")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Profile.objects.filter(user=user).update(height_cm=-1)

    def test_login_is_case_insensitive_and_inactive_users_are_rejected(self):
        user = User.objects.create_user("one@example.com", self.password)
        response = self.write("/api/auth/login/", {"email": "ONE@example.com", "password": self.password})
        self.assertEqual(response.status_code, 200)
        self.write("/api/auth/logout/", {})
        user.is_active = False
        user.save(update_fields=["is_active"])
        self.assertEqual(self.write("/api/auth/login/", {"email": user.email, "password": self.password}).status_code, 401)

    def test_password_reset_is_generic_single_use_and_invalidates_sessions(self):
        self.register()
        user = User.objects.get(email="one@example.com")
        old_client = Client(enforce_csrf_checks=True)
        self.write("/api/auth/login/", {"email": user.email, "password": self.password}, client=old_client)
        user.refresh_from_db()
        token = default_token_generator.make_token(user)
        known = self.write("/api/auth/password-reset/", {"email": user.email})
        unknown = self.write("/api/auth/password-reset/", {"email": "missing@example.com"})
        self.assertEqual(known.status_code, 202)
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(len(mail.outbox), 1)
        match = re.search(r"uid=([^&\s]+)&token=([^\s]+)", mail.outbox[0].body)
        self.assertIsNotNone(match)
        data = {"uid": match[1], "token": match[2], "password": "New-milestone-password!"}
        self.assertEqual(self.write("/api/auth/password-reset/confirm/", data).status_code, 200)
        self.assertEqual(self.write("/api/auth/password-reset/confirm/", data).status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password(data["password"]))
        self.assertFalse(default_token_generator.check_token(user, token))
        self.assertEqual(old_client.get("/api/auth/me/").status_code, 403)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)

    def test_invalid_reset_never_changes_password(self):
        user = User.objects.create_user("one@example.com", self.password)
        response = self.write("/api/auth/password-reset/confirm/", {"uid": "nonsense", "token": "invalid", "password": "New-valid-password!"})
        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password(self.password))

    @override_settings(GOOGLE_CLIENT_ID="")
    def test_unconfigured_google_is_explicit(self):
        self.assertFalse(self.client.get("/api/auth/google/config/").json()["enabled"])
        self.assertEqual(self.write("/api/auth/google/challenge/", {"purpose": "signin"}).status_code, 503)

    def google(self, claims, purpose="signin"):
        challenge = self.write("/api/auth/google/challenge/", {"purpose": purpose})
        self.assertEqual(challenge.status_code, 200, challenge.content)
        claims = {"email_verified": True, "email": "google@gmail.com", "sub": "google-subject", **claims, "nonce": challenge.json()["nonce"]}
        with patch("accounts.views.verify_google_credential", return_value=claims):
            return self.write("/api/auth/google/link/" if purpose == "link" else "/api/auth/google/", {"credential": "test-fixture"})

    @override_settings(GOOGLE_CLIENT_ID="test.apps.googleusercontent.com")
    def test_verified_google_creates_profile_and_uses_subject_for_returning_login(self):
        response = self.google({})
        self.assertEqual(response.status_code, 200, response.content)
        user_id = response.json()["user"]["id"]
        self.assertFalse(response.json()["user"]["has_password"])
        self.assertEqual(AuthIdentity.objects.count(), 1)
        self.write("/api/auth/logout/", {})
        returning = self.google({"email": "changed@gmail.com"})
        self.assertEqual(returning.json()["user"]["id"], user_id)
        self.assertEqual(User.objects.count(), 1)

    @override_settings(GOOGLE_CLIENT_ID="test.apps.googleusercontent.com")
    def test_google_does_not_auto_merge_email_and_explicit_link_is_owner_bound(self):
        owner = User.objects.create_user("google@gmail.com", self.password)
        response = self.google({})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "account_link_required")
        self.assertEqual(AuthIdentity.objects.count(), 0)
        self.write("/api/auth/login/", {"email": owner.email, "password": self.password})
        linked = self.google({}, "link")
        self.assertEqual(linked.status_code, 200, linked.content)
        self.assertEqual(AuthIdentity.objects.get().user_id, owner.pk)
        self.write("/api/auth/logout/", {})
        self.register("other@example.com")
        conflict = self.google({}, "link")
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(AuthIdentity.objects.get().user_id, owner.pk)

    @override_settings(GOOGLE_CLIENT_ID="test.apps.googleusercontent.com")
    def test_google_nonce_and_recent_session_are_required(self):
        self.write("/api/auth/google/challenge/", {"purpose": "signin"})
        with patch("accounts.views.verify_google_credential", return_value={"sub": "s", "email": "g@gmail.com", "nonce": "wrong", "email_verified": True}):
            self.assertEqual(self.write("/api/auth/google/", {"credential": "fixture"}).status_code, 400)
        self.register()
        session = self.client.session
        session["authenticated_at"] = time.time() - 601
        session.save()
        self.assertEqual(self.write("/api/auth/google/challenge/", {"purpose": "link"}).status_code, 401)

    @override_settings(GOOGLE_CLIENT_ID="test.apps.googleusercontent.com")
    def test_google_link_challenge_is_single_use(self):
        self.register()
        challenge = self.write("/api/auth/google/challenge/", {"purpose": "link"})
        claims = {"sub": "one-use", "email": "g@gmail.com", "email_verified": True, "nonce": challenge.json()["nonce"]}
        with patch("accounts.views.verify_google_credential", return_value=claims):
            self.assertEqual(self.write("/api/auth/google/link/", {"credential": "fixture"}).status_code, 200)
            replay = self.write("/api/auth/google/link/", {"credential": "fixture"})
        self.assertEqual(replay.status_code, 400)
        self.assertEqual(replay.json()["code"], "invalid_google_challenge")

    @override_settings(GOOGLE_CLIENT_ID="test.apps.googleusercontent.com")
    def test_google_verifier_checks_audience_and_rejects_unverified_email(self):
        with patch("accounts.services.id_token.verify_oauth2_token", return_value={"sub": "s", "email": "g@gmail.com", "email_verified": True}) as verify:
            verify_google_credential("fixture")
            self.assertEqual(verify.call_args.args[0], "fixture")
            self.assertEqual(verify.call_args.args[2], "test.apps.googleusercontent.com")
        for result in ({"email_verified": False}, {"email_verified": "true"}):
            with patch("accounts.services.id_token.verify_oauth2_token", return_value=result), self.assertRaises(AccountError):
                verify_google_credential("fixture")
        with patch("accounts.services.id_token.verify_oauth2_token", side_effect=ValueError("invalid")), self.assertRaises(AccountError):
            verify_google_credential("fixture")
        with patch("accounts.services.id_token.verify_oauth2_token", side_effect=TransportError("network")), self.assertRaises(AccountError) as caught:
            verify_google_credential("fixture")
        self.assertEqual(caught.exception.status_code, 503)

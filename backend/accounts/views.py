import logging
import secrets
import smtplib
import time
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import AuthIdentity, Profile, User
from .serializers import (CredentialsSerializer, GoogleChallengeSerializer, GoogleCredentialSerializer,
                          ProfileSerializer, ProfileUpdateSerializer, RegisterSerializer,
                          ResetConfirmSerializer, ResetRequestSerializer)
from .services import AccountError, consume_google_challenge, verify_google_credential

logger = logging.getLogger(__name__)


def account_payload(request, user):
    return {
        "user": {"id": str(user.pk), "email": user.email, "has_password": user.has_usable_password()},
        "profile": ProfileSerializer(user.profile).data,
        "identities": list(user.identities.values_list("provider", flat=True).distinct()),
        "csrf_token": get_token(request),
    }


def establish_session(request, user):
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    request.session["authenticated_at"] = time.time()
    return account_payload(request, user)


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class AccountAPIView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(AccountAPIView):
    throttle_classes = []
    def get(self, request):
        return Response({"csrf_token": get_token(request)})


class RegisterView(AccountAPIView):
    def post(self, request):
        if request.user.is_authenticated:
            raise AccountError("Sign out before creating another account.", "already_authenticated", 409)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.create_user(**serializer.validated_data)
        except IntegrityError as exc:
            raise AccountError("An account with that email already exists.", "email_exists", 409) from exc
        return Response(establish_session(request, user), status=201)


class LoginView(AccountAPIView):
    def post(self, request):
        if request.user.is_authenticated:
            raise AccountError("Sign out before switching accounts.", "already_authenticated", 409)
        serializer = CredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, username=serializer.validated_data["email"], password=serializer.validated_data["password"])
        if user is None:
            raise AccountError("Email or password is incorrect.", "invalid_credentials", 401)
        return Response(establish_session(request, user))


class LogoutView(AccountAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "Signed out.", "csrf_token": get_token(request)})


class MeView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = []

    def get(self, request):
        return Response(account_payload(request, request.user))


class ProfileView(AccountAPIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "profile"

    def get(self, request):
        return Response(ProfileSerializer(request.user.profile).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        expected_revision = fields.pop("revision")
        with transaction.atomic():
            profile = Profile.objects.select_for_update().get(user=request.user, deleted_at__isnull=True)
            if profile.revision != expected_revision:
                return Response({"detail": "Your profile changed. Reload before saving.", "code": "revision_conflict", "profile": ProfileSerializer(profile).data}, status=409)
            for key, value in fields.items():
                setattr(profile, key, value)
            if fields:
                profile.revision += 1
                profile.save(update_fields=[*fields, "revision", "updated_at"])
        return Response(ProfileSerializer(profile).data)


class PasswordResetRequestView(AccountAPIView):
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()
        if user:
            query = urlencode({"uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": default_token_generator.make_token(user)})
            url = f"{settings.FRONTEND_URL}/reset-password?{query}"
            try:
                send_mail("Reset your TrainFuel password", f"Use this link to reset your password:\n{url}\n\nIf you did not request this, ignore this message. The link expires in one hour.", settings.DEFAULT_FROM_EMAIL, [user.email])
            except (smtplib.SMTPException, OSError):
                logger.warning("Password recovery mail could not be delivered.")
        return Response({"detail": "If an active account exists, a recovery email will be sent."}, status=202)


class PasswordResetConfirmView(AccountAPIView):
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            user_id = force_str(urlsafe_base64_decode(values["uid"]))
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=user_id, is_active=True)
                if not default_token_generator.check_token(user, values["token"]):
                    raise AccountError("This recovery link is invalid or expired.", "invalid_reset_token")
                try:
                    validate_password(values["password"], user)
                except DjangoValidationError as exc:
                    raise serializers.ValidationError({"password": exc.messages}) from exc
                user.set_password(values["password"])
                user.email_verified_at = timezone.now()
                user.save(update_fields=["password", "email_verified_at"])
        except (ValueError, TypeError, DjangoValidationError, User.DoesNotExist) as exc:
            raise AccountError("This recovery link is invalid or expired.", "invalid_reset_token") from exc
        logout(request)
        return Response({"detail": "Password updated. Sign in with your new password.", "csrf_token": get_token(request)})


class GoogleConfigView(AccountAPIView):
    throttle_classes = []
    def get(self, request):
        return Response({"enabled": bool(settings.GOOGLE_CLIENT_ID), "client_id": settings.GOOGLE_CLIENT_ID})


class GoogleChallengeView(AccountAPIView):
    def post(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            raise AccountError("Google sign-in is not configured.", "google_unavailable", 503)
        serializer = GoogleChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purpose = serializer.validated_data["purpose"]
        if purpose == "link":
            if not request.user.is_authenticated:
                raise AccountError("Sign in before linking Google.", "authentication_required", 401)
            if time.time() - request.session.get("authenticated_at", 0) > 600:
                raise AccountError("Sign out and sign in again before linking Google.", "reauthentication_required", 401)
        elif request.user.is_authenticated:
            raise AccountError("Sign out before switching accounts.", "already_authenticated", 409)
        nonce = secrets.token_urlsafe(32)
        request.session["google_challenge"] = {"nonce": nonce, "purpose": purpose, "created_at": time.time(), "user_id": str(request.user.pk) if request.user.is_authenticated else None}
        return Response({"nonce": nonce, "client_id": settings.GOOGLE_CLIENT_ID})


class GoogleLoginView(AccountAPIView):
    def post(self, request):
        if request.user.is_authenticated:
            raise AccountError("Sign out before switching accounts.", "already_authenticated", 409)
        serializer = GoogleCredentialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_google_credential(serializer.validated_data["credential"])
        consume_google_challenge(request, claims, "signin")
        try:
            with transaction.atomic():
                identity = AuthIdentity.objects.select_related("user").filter(provider="google", provider_subject=claims["sub"]).first()
                if identity:
                    user = identity.user
                else:
                    email = serializers.EmailField(max_length=254).run_validation(claims["email"]).lower()
                    if User.objects.filter(email__iexact=email).exists():
                        raise AccountError("Sign in to your existing account and link Google in settings.", "account_link_required", 409)
                    user = User.objects.create_user(email=email)
                    # Only Google's authoritative email domains establish current email ownership.
                    if email.endswith("@gmail.com") or claims.get("hd"):
                        user.email_verified_at = timezone.now()
                        user.save(update_fields=["email_verified_at"])
                    AuthIdentity.objects.create(user=user, provider="google", provider_subject=claims["sub"])
                if not user.is_active:
                    raise AccountError("This account is unavailable.", "invalid_credentials", 401)
        except IntegrityError as exc:
            raise AccountError("The account changed. Start a new sign-in attempt.", "identity_conflict", 409) from exc
        return Response(establish_session(request, user))


class GoogleLinkView(AccountAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if time.time() - request.session.get("authenticated_at", 0) > 600:
            raise AccountError("Sign out and sign in again before linking Google.", "reauthentication_required", 401)
        serializer = GoogleCredentialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_google_credential(serializer.validated_data["credential"])
        consume_google_challenge(request, claims, "link")
        try:
            with transaction.atomic():
                identity, _ = AuthIdentity.objects.get_or_create(provider="google", provider_subject=claims["sub"], defaults={"user": request.user})
                if identity.user_id != request.user.pk:
                    raise AccountError("That Google identity belongs to another account.", "identity_conflict", 409)
        except IntegrityError as exc:
            raise AccountError("That Google identity could not be linked. Try again.", "identity_conflict", 409) from exc
        return Response(account_payload(request, request.user))

import secrets
import time
from functools import partial

from django.conf import settings
from django.contrib.sessions.models import Session
from django.db import transaction
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from rest_framework.exceptions import APIException


class AccountError(APIException):
    def __init__(self, detail, code, status=400):
        self.status_code = status
        super().__init__({"detail": detail, "code": code})


def verify_google_credential(credential):
    if not settings.GOOGLE_CLIENT_ID:
        raise AccountError("Google sign-in is not configured.", "google_unavailable", 503)
    try:
        # Google's library checks the signature, audience, issuer, and expiry.
        claims = id_token.verify_oauth2_token(credential, partial(Request(), timeout=10), settings.GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise AccountError("The Google credential is invalid or expired.", "invalid_google_token") from exc
    except GoogleAuthError as exc:
        raise AccountError("Google verification is temporarily unavailable.", "google_unavailable", 503) from exc
    if claims.get("email_verified") is not True or not claims.get("email") or not claims.get("sub"):
        raise AccountError("Google must verify this identity's email.", "invalid_google_token")
    if not isinstance(claims["sub"], str) or len(claims["sub"]) > 255:
        raise AccountError("The Google identity is invalid.", "invalid_google_token")
    return claims


def consume_google_challenge(request, claims, purpose):
    # Lock the durable session row so the same challenge cannot be consumed twice.
    with transaction.atomic():
        session = Session.objects.select_for_update().filter(session_key=request.session.session_key).first()
        challenge = session.get_decoded().get("google_challenge", {}) if session else {}
        expected = challenge.get("nonce", "")
        received = claims.get("nonce", "")
        if (
            not expected or not isinstance(received, str)
            or not secrets.compare_digest(expected, received)
            or challenge.get("purpose") != purpose
            or time.time() - challenge.get("created_at", 0) > 300
            or (purpose == "link" and challenge.get("user_id") != str(request.user.pk))
        ):
            raise AccountError("Start a new Google sign-in attempt.", "invalid_google_challenge")
        request.session.pop("google_challenge", None)
        request.session.save()

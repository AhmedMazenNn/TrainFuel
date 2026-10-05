from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Profile, User


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({key: ["This field cannot be submitted."] for key in unknown})
        return super().to_internal_value(data)


class CredentialsSerializer(StrictSerializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=128, write_only=True)

    def validate_email(self, value):
        return value.strip().lower()


class RegisterSerializer(CredentialsSerializer):
    def validate(self, attrs):
        try:
            validate_password(attrs["password"], User(email=attrs["email"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs


class ProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Profile
        fields = ["user_id", "display_name", "timezone", "weight_unit", "language", "goal", "height_cm", "revision", "created_at", "updated_at"]
        read_only_fields = fields


class ProfileUpdateSerializer(StrictSerializer):
    revision = serializers.IntegerField(min_value=1)
    display_name = serializers.CharField(max_length=100, required=False)
    timezone = serializers.CharField(max_length=100, required=False)
    weight_unit = serializers.ChoiceField(choices=["kg", "lb"], required=False)
    language = serializers.ChoiceField(choices=["en", "ar"], required=False)
    goal = serializers.ChoiceField(choices=["cutting", "bulking"], required=False)
    height_cm = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"), allow_null=True, required=False)

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise serializers.ValidationError("Choose a valid IANA timezone.") from exc
        return value


class ResetRequestSerializer(StrictSerializer):
    email = serializers.EmailField(max_length=254)


class ResetConfirmSerializer(StrictSerializer):
    uid = serializers.CharField(max_length=128)
    token = serializers.CharField(max_length=128)
    password = serializers.CharField(trim_whitespace=False, max_length=128, write_only=True)


class GoogleChallengeSerializer(StrictSerializer):
    purpose = serializers.ChoiceField(choices=["signin", "link"])


class GoogleCredentialSerializer(StrictSerializer):
    credential = serializers.CharField(max_length=10000, trim_whitespace=False)

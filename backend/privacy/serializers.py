from rest_framework import serializers
from accounts.serializers import StrictSerializer


class ExportRequestSerializer(StrictSerializer):
    include_photos = serializers.BooleanField(default=False)


class DeleteRequestSerializer(StrictSerializer):
    confirmation_email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=128, write_only=True, required=False, allow_blank=False)


class ReceiptSerializer(StrictSerializer):
    token = serializers.CharField(max_length=128, trim_whitespace=False)

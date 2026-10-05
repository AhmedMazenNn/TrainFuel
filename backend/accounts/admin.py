from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db import transaction

from .models import Profile, User


@admin.register(User)
class AccountAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "is_staff", "is_catalog_admin", "is_active")
    search_fields = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "is_catalog_admin", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "email_verified_at")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            Profile.objects.get_or_create(user=obj)

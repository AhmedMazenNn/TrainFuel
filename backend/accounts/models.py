import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models, transaction
from django.db.models.functions import Lower


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email).strip().lower(), **extra_fields)
        user.set_password(password)
        with transaction.atomic(using=self._db):
            user.save(using=self._db)
            Profile.objects.using(self._db).create(user=user)
        return user

    def get_by_natural_key(self, email):
        return self.get(email__iexact=email)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True or extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser requires is_staff=True and is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    is_catalog_admin = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        constraints = [models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique")]


class Profile(models.Model):
    user = models.OneToOneField(User, primary_key=True, on_delete=models.PROTECT, related_name="profile")
    display_name = models.CharField(max_length=100, blank=True, default="")
    timezone = models.CharField(max_length=100, default="UTC")
    weight_unit = models.CharField(max_length=2, choices=[("kg", "kg"), ("lb", "lb")], default="kg")
    language = models.CharField(max_length=2, choices=[("en", "English"), ("ar", "Arabic")], default="en")
    goal = models.CharField(max_length=7, choices=[("cutting", "Cutting"), ("bulking", "Bulking")], default="cutting")
    height_cm = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    revision = models.PositiveBigIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(height_cm__isnull=True) | models.Q(height_cm__gt=0), name="profile_positive_height"),
            models.CheckConstraint(condition=models.Q(revision__gte=1), name="profile_positive_revision"),
            models.CheckConstraint(condition=models.Q(weight_unit__in=["kg", "lb"]), name="profile_valid_unit"),
            models.CheckConstraint(condition=models.Q(language__in=["en", "ar"]), name="profile_valid_language"),
            models.CheckConstraint(condition=models.Q(goal__in=["cutting", "bulking"]), name="profile_valid_goal"),
        ]


class AuthIdentity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="identities")
    provider = models.CharField(max_length=10, choices=[("google", "Google")])
    provider_subject = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider", "provider_subject"], name="identity_unique_provider_subject"),
            models.CheckConstraint(condition=models.Q(provider="google"), name="identity_google_provider"),
        ]

import uuid

from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import User


class UserTests(TestCase):
    def test_uuid_identity_and_password_hashing(self):
        user = User.objects.create_user("Person@Example.com", "test-password")
        self.assertIsInstance(user.pk, uuid.UUID)
        self.assertEqual(user.email, "person@example.com")
        self.assertTrue(user.check_password("test-password"))
        self.assertFalse(user.is_catalog_admin)

    def test_case_insensitive_email_uniqueness_at_database_boundary(self):
        User.objects.create_user("person@example.com")
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create(email="PERSON@example.com", password="!")

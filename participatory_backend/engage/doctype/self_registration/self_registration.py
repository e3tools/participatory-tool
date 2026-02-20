# Copyright (c) 2025, Steve Nyaga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.core.doctype.user.user import User

DEFAULT_ROLES = [
    "Data Capture",
    "Form Design Manager",
    "Form Design User",
    "Form Designer Manager",
    "Technical Data Manager",
    "Technical Data User",
    "Script Manager",
    "Insights User",
]
ROLE_PROFILE = "Participatory Process"
MODULE_PROFILE = "Participatory Process"


class SelfRegistration(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        department: DF.Data
        designation: DF.Data
        email_address: DF.Data | None
        first_name: DF.Data
        gender: DF.Link
        last_name: DF.Data
        middle_name: DF.Data | None
        personal_number: DF.Data
        phone_number: DF.Data
    # end: auto-generated types
    pass

    def validate(self):
        def _create_role_profile():
            if not frappe.db.exists("Role Profile", ROLE_PROFILE):
                role_profile = frappe.new_doc("Role Profile")
                role_profile.role_profile = ROLE_PROFILE
                for role in DEFAULT_ROLES:
                    role_profile.append("roles", {"role": role})

                role_profile.insert(ignore_permissions=True)

        def _create_module_profile():
            if not frappe.db.exists("Module Profile", MODULE_PROFILE):
                frappe.get_doc(
                    {
                        "doctype": "Module Profile",
                        "module_profile_name": MODULE_PROFILE,
                        # "block_modules": [
                        #     {"module": "Core"},
                        #     {"module": "Desk"},
                        #     {"module": "Engage"},
                        #     {"module": "Engage Trigger"},
                        #     {"module": "Gis"},
                        #     {"module": "Technical"},
                        # ],
                        "block_modules": [
                            {"module": "Automation"},
                            {"module": "Contacts"},
                            {"module": "Custom"},
                            {"module": "Email"},
                            {"module": "Integrate"},
                            {"module": "Integrations"},
                            {"module": "Social"},
                            {"module": "Website"},
                        ],
                    }
                ).insert()

        _create_role_profile()
        _create_module_profile()

        user: User = frappe.new_doc("User")
        user.email = self.email_address
        user.enabled = 1
        user.first_name = self.first_name
        user.middle_name = self.middle_name
        user.last_name = self.last_name
        user.interest = self.designation
        user.bio = self.personal_number
        user.mobile_no = self.phone_number
        user.gender = self.gender
        user.location = self.department
        user.send_welcome_email = 0
        user.new_password = self.personal_number[:6]
        user.role_profile_name = ROLE_PROFILE
        user.module_profile = MODULE_PROFILE

        if frappe.db.exists("User", {"email": self.email_address}):
            frappe.throw("You have already registered")
        else:
            user.insert(ignore_permissions=True)

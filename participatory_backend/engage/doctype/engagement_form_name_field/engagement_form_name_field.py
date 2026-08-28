# Copyright (c) 2026, Steve Nyaga and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EngagementFormNameField(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		custom_text: DF.Data | None
		form_field: DF.Literal[None]
		input_type: DF.Literal["Form Field", "Day", "Week", "Month", "Short Year", "Full Year", "Numeric Series", "Custom Text"]
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		separator: DF.Data | None
	# end: auto-generated types
	pass

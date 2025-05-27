# Copyright (c) 2023, Steve Nyaga and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EngagementEntry(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		client_entry_id: DF.Data | None
		engagement: DF.Link
		engagement_name: DF.ReadOnly | None
		entered_by: DF.Link
		entered_on: DF.Datetime
		status: DF.Literal["Draft", "Submitted", "Cancelled"]
	# end: auto-generated types
	pass

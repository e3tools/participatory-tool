# Copyright (c) 2025, Steve Nyaga and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EngagementTriggerRelatedFormItem(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		current_form_field: DF.Literal[None]
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		related_form_field: DF.Literal[None]
		source: DF.Literal["", "From Current Form Field", "Specific Value"]
		update_value: DF.SmallText | None
	# end: auto-generated types
	pass

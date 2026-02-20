# Copyright (c) 2024, Steve Nyaga and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EngagementFormPermission(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		perm_create: DF.Check
		perm_delete: DF.Check
		perm_export: DF.Check
		perm_import: DF.Check
		perm_print: DF.Check
		perm_read: DF.Check
		perm_report: DF.Check
		perm_select: DF.Check
		perm_write: DF.Check
		role: DF.Link
	# end: auto-generated types
	pass

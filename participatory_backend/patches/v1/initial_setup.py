import frappe


def execute():
    """
    Do initial setup for the system
    """
    # disable signup
    settings = frappe.get_single("System Settings")

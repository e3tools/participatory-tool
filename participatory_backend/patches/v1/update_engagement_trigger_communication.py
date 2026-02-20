import frappe


def execute():
    """
    Update communication for engagement triggers
    """
    triggers = frappe.db.get_list("Engagement Trigger", order_by="modified asc")
    not_processed = []
    for trigger in triggers:
        print(f"Processing Trigger: {trigger.name}")
        doc = frappe.get_doc("Engagement Trigger", trigger.name)
        if not doc.via_sms:
            doc.via_sms = doc.channel == "SMS"
        if not doc.via_email:
            doc.via_email = doc.channel == "Email"

        # reset the channel to None
        doc.channel = None
        try:
            doc.save()
        except Exception as e:
            not_processed.append(trigger.name)
            print(str(e))

    if not_processed:
        print("Not processed: ", not_processed)

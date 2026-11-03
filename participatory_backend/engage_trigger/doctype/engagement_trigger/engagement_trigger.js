// Copyright (c) 2025, Steve Nyaga and contributors
// For license information, please see license.txt
cur_frm.add_fetch("engagement_form", "form_group", "form_group");

let UPDATEABLE_TYPES = [
  "Data",
  "Text",
  "Small Text",
  "Long Text",
  "Int",
  "Currency",
  "Float",
  "Date",
  "Datetime",
  "Select",
  "Percent",
  "Link",
  "Linked Field",
  "Read Only",
];

let INITIAL_FORM = "";
let INITIAL_CONDITIONS = "";

frappe.ui.form.on("Engagement Trigger", {
  onload(frm) {
    frm.set_query("print_format", function () {
      return {
        filters: {
          doc_type: frm.doc.engagement_form,
        },
      };
    });

    //hide whatsapp
    frm.set_df_property("via_whatsapp", "hidden", true);

    // Get the values for currently loaded form
    INITIAL_FORM = frm.doc.engagement_form;
    INITIAL_CONDITIONS = frm.doc.conditions_plain;
    frm.trigger("setup_skip_conditions");
  },
  refresh(frm) {
    frm.trigger("engagement_form");
    frm.trigger("related_form");

    frm.add_fetch("sender", "email_id", "sender_email");
    frm.set_query("sender", () => {
      return {
        filters: {
          enable_outgoing: 1,
        },
      };
    });

    // if (frm.doc.engagement_form === INITIAL_FORM) {
    //   INITIAL_CONDITIONS = frm.doc.conditions_plain;
    // }
    frm.trigger("set_email_builder");
  },
  engagement_form: function (frm) {
    if (!frm.doc.engagement_form) {
      return;
    }

    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
      args: {
        doctype: frm.doc.engagement_form,
      },
      freeze: true,
      callback: function (r) {
        let fields = [
          {
            label: "ID",
            value: "name", // + " (" + __(el.label) + ")",
          },
        ];
        let link_fields = [];
        if (r.message) {
          r.message.forEach((el) => {
            if (
              !frappe.model.no_value_type.includes(el.fieldtype) &&
              UPDATEABLE_TYPES.includes(el.fieldtype)
            ) {
              fields.push({
                // label:
                //   __(el.label) +
                //   " - " +
                //   " (" +
                //   el.fieldtype +
                //   ") " +
                //   el.fieldname,
                label: make_field_display_value(el),
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
            // Get a Link form that has the Engagement Form as options
            if (
              el.fieldtype === "Link" &&
              el.options === frm.doc.related_form
            ) {
              link_fields.push({
                label: __(el.label) + " - " + el.fieldname,
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
          });
          fields.sort((a, b) =>
            a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
          );
          frm.fields_dict.set_property_after_trigger_items.grid.update_docfield_property(
            "field_to_update",
            "options",
            fields,
          );
          frm.fields_dict.related_form_field_items.grid.update_docfield_property(
            "current_form_field",
            "options",
            fields,
          );
          frm.set_df_property(
            "field_linking_forms",
            "options",
            link_fields,
            frm.doc.name,
          );
          // load all except id field
          frm.set_df_property(
            "change_field",
            "options",
            fields.filter((el) => el.value != "name"),
            frm.doc.name,
          );

          // frm.trigger("make_recipient_fields");
          make_recipient_fields(frm, r.message); // fields);
        }
      },
    });

    frm.trigger("set_email_builder");
  },
  related_form: function (frm) {
    if (!frm.doc.related_form) {
      return;
    }
    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
      args: {
        doctype: frm.doc.related_form,
      },
      freeze: true,
      callback: function (r) {
        let fields = [];
        if (r.message) {
          r.message.forEach((el) => {
            if (!frappe.model.no_value_type.includes(el.fieldtype)) {
              fields.push({
                // label:
                //   el.fieldname +
                //   " (" +
                //   __(el.label) +
                //   " - " +
                //   el.fieldtype +
                //   ")",
                label: make_field_display_value(el),
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
          });
          fields.sort((a, b) =>
            a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
          );
          frm.fields_dict.related_form_field_items.grid.update_docfield_property(
            "related_form_field",
            "options",
            fields,
          );
        }
        frm.trigger("engagement_form"); //reload fields so as to select the linking field
      },
    });
  },
  outcome_type: function (frm) {
    if (frm.doc.outcome_type === "Update Another Form Record") {
      frm.trigger("related_form");
    }
  },
  set_condition: function (frm) {
    let doc = frm.doc;
    if (!doc.engagement_form) {
      msgprint(__("You must select the Engagement Form first"));
      return;
    }
    edit_filters(frm, doc.engagement_form, doc.condition || "{}", (filters) => {
      frappe.model.set_value(doc.doctype, doc.name, "condition", filters);
    });
  },
  channel: function (frm) {
    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
      args: {
        doctype: frm.doc.engagement_form,
      },
      freeze: true,
      callback: function (r) {
        if (r.message) {
          make_recipient_fields(frm, r.message); // fields);
        }
      },
    });
  },
  setup: function (frm) {
    // frm.trigger("setup_skip_conditions");
  },
  setup_skip_conditions: function (frm) {
    set_skip_logic_conditions(frm);
  },
  engagement_form2: function (frm) {
    // let conds =
    //   frm.doc.engagement_form === INITIAL_FORM ? INITIAL_CONDITIONS : "";
    // reset_conditions(frm);
    // frappe.model.set_value(
    //   frm.doc.doctype,
    //   frm.doc.name,
    //   "conditions_plain",
    //   conds,
    // );
    // set_skip_logic_conditions(frm);
  },
  set_email_builder: function (frm) {
    // Ensure the JS asset is loaded
    // frappe.require(
    //   "/assets/participatory_backend/js/email_builder.js",
    //   "email_builder.js",
    //   function () {
    if (!frm.doc.engagement_form) {
      return;
    }

    // 1. Prepare container inside Frappe HTML field
    const wrapper = frm.fields_dict.email_message_builder.$wrapper;
    wrapper.empty();
    const container = $('<div id="email-builder-mount"></div>').appendTo(
      wrapper,
    );

    // 2. Fetch DocType Meta dynamically to populate field catalog
    frappe.model.with_doctype(frm.doc.engagement_form, function () {
      const meta = frappe.get_meta(frm.doc.engagement_form);
      const docfields = meta.fields
        .filter(
          (df) =>
            !["Section Break", "Column Break", "HTML", "Table"].includes(
              df.fieldtype,
            ),
        )
        .map((df) => ({
          fieldname: df.fieldname,
          label: df.label || df.fieldname,
          fieldtype: df.fieldtype,
        }));

      // 3. Initialize Visual Builder
      frm.email_builder = new FrappeVisualEmailBuilder(container[0], {
        doctype: frm.doc.engagement_form,
        docfields: docfields,
        initialSubject: frm.doc.subject || "",
        initialContent: frm.doc.message || "",
        onChange: function (vals) {
          // Automatically update hidden response_html field in Frappe
          frm.set_value("message", vals.message);
          frm.set_value("subject", vals.subject);
        },
      });
    });
    //   },
    // );
  },

  set_email_builder_async: function (frm) {
    // Ensure the JS asset is loaded
    frappe.require(
      "/assets/participatory_backend/js/email_builder.js",
      // "email_builder.js",
      function () {
        if (!frm.doc.engagement_form) {
          return;
        }

        // 1. Prepare container inside Frappe HTML field
        const wrapper = frm.fields_dict.email_message_builder.$wrapper;
        wrapper.empty();
        const container = $('<div id="email-builder-mount"></div>').appendTo(
          wrapper,
        );

        // 2. Fetch DocType Meta dynamically to populate field catalog
        frappe.model.with_doctype(frm.doc.engagement_form, function () {
          const meta = frappe.get_meta(frm.doc.engagement_form);
          const docfields = meta.fields
            .filter(
              (df) =>
                !["Section Break", "Column Break", "HTML", "Table"].includes(
                  df.fieldtype,
                ),
            )
            .map((df) => ({
              fieldname: df.fieldname,
              label: df.label || df.fieldname,
              fieldtype: df.fieldtype,
            }));

          // 3. Initialize Visual Builder
          frm.email_builder = new FrappeVisualEmailBuilder(container[0], {
            doctype: frm.doc.engagement_form,
            docfields: docfields,
            initialSubject: frm.doc.subject || "",
            initialContent: frm.doc.message || "",
            onChange: function (vals) {
              // Automatically update hidden response_html field in Frappe
              frm.set_value("message", vals.message);
              frm.set_value("subject", vals.subject);
            },
          });
        });
      },
    );
  },
});

function edit_filters(frm, doctype, existing_filters, on_add_filter) {
  let field_doctype = doctype;
  //   const { frm } = store;
  make_filters_dialog(frm, on_add_filter);

  make_filters_area(frm, field_doctype);
  frappe.model.with_doctype(field_doctype, () => {
    frm.dialog.show();
    //  add_existing_filter(frm, child);

    if (existing_filters) {
      let filters = JSON.parse(existing_filters);
      if (filters) {
        frm.filter_group.add_filters_to_filter_group(filters);
      }
    }
  });
}

function make_filters_dialog(frm, /*child,*/ on_add_filter) {
  frm.dialog = new frappe.ui.Dialog({
    title: __("Set Filters"),
    fields: [
      {
        fieldtype: "HTML",
        fieldname: "filter_area",
      },
    ],
    primary_action: () => {
      //let fieldname = props.field.df.fieldname;
      //   let field_option = props.field.df.options;
      let filters = frm.filter_group.get_filters().map((filter) => {
        // last element is a boolean which hides the filter hence not required to store in meta
        filter.pop();

        // filter_group component requires options and frm.set_query requires fieldname so storing both
        // filter[0] = field_option;
        return filter;
      });

      let link_filters = JSON.stringify(filters);

      on_add_filter(link_filters);
      //   store.form.selected_field = props.field.df;

      /*
      frappe.model.set_value(
        child.doctype,
        child.name,
        "field_filters",
        link_filters
      );*/
      frm.dialog.hide();
    },
    primary_action_OLD: () => {
      //let fieldname = props.field.df.fieldname;
      //   let field_option = props.field.df.options;
      let filters = frm.filter_group.get_filters().map((filter) => {
        // last element is a boolean which hides the filter hence not required to store in meta
        filter.pop();

        // filter_group component requires options and frm.set_query requires fieldname so storing both
        // filter[0] = field_option;
        return filter;
      });

      let link_filters = JSON.stringify(filters);
      //   store.form.selected_field = props.field.df;
      frappe.model.set_value(
        child.doctype,
        child.name,
        "field_filters",
        link_filters,
      );
      frm.dialog.hide();
    },
    primary_action_label: __("Apply"),
  });
}

function make_filters_area(frm, doctype) {
  frm.filter_group = new frappe.ui.FilterGroup({
    parent: frm.dialog.get_field("filter_area").$wrapper,
    doctype: doctype,
    on_change: () => {},
  });
}

function add_existing_filter(frm, child) {
  if (child.field_filters) {
    let filters = JSON.parse(child.field_filters);
    if (filters) {
      frm.filter_group.add_filters_to_filter_group(filters);
    }
  }
}

function edit_filters_link(frm, child) {
  let field_doctype = child.field_doctype;
  //   const { frm } = store;
  make_filters_dialog(frm, child);
  make_filters_area(frm, field_doctype);
  frappe.model.with_doctype(field_doctype, () => {
    frm.dialog.show();
    add_existing_filter(frm, child);
  });
}

function get_select_options(df, parent_field) {
  // Append parent_field name along with fieldname for child table fields
  let select_value = parent_field
    ? df.fieldname + "," + parent_field
    : df.fieldname;

  return {
    value: select_value,
    //label: df.fieldname + " (" + __(df.label, null, df.parent) + ")",
    label: df.label + " (" + __(df.fieldname, null, df.parent) + ")",
  };
}

function make_recipient_fields(frm, fields) {
  let receiver_fields = [];
  if (frm.doc.channel === "Email" || frm.doc.via_email) {
    receiver_fields = $.map(fields || [], function (d) {
      // Add User and Email fields from child into select dropdown
      if (frappe.model.table_fields.includes(d.fieldtype)) {
        let child_fields = frappe.get_doc("DocType", d.options).fields;
        return $.map(child_fields || [], function (df) {
          return df.options == "Email" ||
            df.fieldtype == "Read Only" || // include read only fields as some might include emails
            (df.options == "User" && df.fieldtype == "Link")
            ? get_select_options(df, d.fieldname)
            : null;
        });
        // Add User and Email fields from parent into select dropdown
      } else {
        return d.options == "Email" ||
          d.fieldtype == "Read Only" ||
          (d.options == "User" && d.fieldtype == "Link")
          ? get_select_options(d)
          : null;
      }
    });
  } else if (
    ["WhatsApp", "SMS"].includes(frm.doc.channel) ||
    frm.doc.via_sms ||
    frm.doc.via_whatsapp
  ) {
    receiver_fields = $.map(fields || [], function (d) {
      return d.options == "Phone" || d.fieldtype == "Read Only"
        ? get_select_options(d)
        : null;
    });
  }

  // set email recipient options
  frm.fields_dict.recipients.grid.update_docfield_property(
    "receiver_by_document_field",
    "options",
    // [""].concat(["owner"]).concat(receiver_fields)
    [""].concat(receiver_fields),
  );
}

/**
 * Format JS filter into Python equivalent
 * Filter comes as an array e.g ["General Test Form","age","=",12]
 * @param {*} filter
 */
function format_filter_for_python(filter) {
  const field = `doc.${filter[1]}`;
  const operator = filter[2];
  const value = filter[3];
}

function make_field_display_value(df) {
  return __(df.label) + " (" + df.fieldname + " - " + df.fieldtype + ")";
}

// frappe.ui.form.on("Engagement Trigger Update Field Item", {
// 	refresh(frm) {

// 	},
//     engagement_form: function(frm, cdt, cdn) { // cdt and cdn are related to the child table
//         var row = local[cdt][cdn];
//         // Make a call to the server-side function to get the options
//         frappe.call({
//             method: 'participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields',
//             args: {
//                 category: frm.doc.engagement_form // Assuming the category is in a field on the parent table
//             },
//             success: function(result) {
//                 // Populate the Select field with the received options
//                 cur_frm.set_df_property('field_to_update', 'options', result.message);
//                 cur_frm.refresh_field('field_to_update'); // Refresh to update the UI
//             }
//         });
//     }
// });

function reset_conditions(frm) {
  let parent = frm.get_field("conditions_loading").$wrapper;
  parent.empty();
  frappe.model.set_value(frm.doctype, frm.docname, "conditions_plain", "");
}

function set_skip_logic_conditions(frm) {
  let cdt = frm.doc.doctype;
  let cdn = frm.doc.name;

  function _set_conditions(filters_field_name, filters_loading_field_name) {
    function _set_form_filter_values() {
      let filters = filter_group.get_filters();
      // each filter returns an list of arrays where each 5th item in the array says if the field is hidden or not.
      // We need to remove the value of hidden property as they are not important in the backend context
      filters = (filters || []).map((el) => {
        return el.length == 5 ? el.slice(0, 4) : el;
      });

      frappe.model.set_value(
        cdt,
        cdn,
        filters_field_name,
        JSON.stringify(filters),
      );
    }
    // let dialog = frm.fields_dict.form_fields.grid.open_grid_row;
    // if (!dialog) return;
    let parent = frm.get_field(filters_loading_field_name).$wrapper;
    parent.empty();

    // let conds_field = frm.get_field(filters_field_name).$wrapper;
    // conds_field.text("");

    let filter_group = new frappe.ui.FilterGroup({
      parent: parent,
      doctype: frm.doc.engagement_form, // frm.doc.doctype, // frm.doc.name,
      on_change: () => {
        setTimeout(() => {
          // Call this after a delay to ensure values reflect correctly
          _set_form_filter_values();
        }, 500);
      },
    });

    const existing_filters = generate_filter_from_json(
      frm,
      frm.doc.doctype,
      frm.doc.name,
      filters_field_name,
    );
    if (existing_filters) {
      if (existing_filters) {
        filter_group.add_filters_to_filter_group(existing_filters);
      }

      frappe.model.set_value(
        cdt,
        cdn,
        filters_field_name,
        JSON.stringify(existing_filters),
      );
    }
  }

  // _create_filter_area();
  if (frm.doc.engagement_form) {
    frappe.model.with_doctype(frm.doc.engagement_form, () => {
      _set_conditions("conditions_plain", "conditions_loading");
      // _set_conditions(
      //   "mandatory_depends_on_plain",
      //   "mandatory_field_filters_loading",
      // );
      // _set_conditions(
      //   "read_only_depends_on_plain",
      //   "readonly_field_filters_loading",
      // );
    });
  }
}

function generate_filter_from_json(frm, dt, dn, filters_field_name) {
  let filters = [];
  if (!frm.doc.__islocal && frm.doc.name) {
    let child = locals[dt][dn];
    filters = frappe.utils.get_filter_from_json(
      child[filters_field_name],
      frm.doc.doctype, //frm.doc.form_name
    );
  }
  return filters;
}

/**
 * Frappe Visual Email Builder v15.5
 * Self-contained visual template designer for non-technical users with Subject Builder.
 */
class FrappeVisualEmailBuilder {
  constructor(container, options = {}) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;
    if (!this.container) throw new Error("Target container not found.");

    this.options = Object.assign(
      {
        doctype: "Sales Order",
        docname: "SO-2026-00042",
        baseUrl:
          window.location.origin !== "null"
            ? window.location.origin
            : "https://your-frappe-site.com",
        docfields: [
          { fieldname: "name", label: "Document ID", fieldtype: "Data" },
          { fieldname: "customer", label: "Customer Name", fieldtype: "Link" },
          {
            fieldname: "posting_date",
            label: "Posting Date",
            fieldtype: "Date",
          },
          {
            fieldname: "grand_total",
            label: "Grand Total",
            fieldtype: "Currency",
          },
          { fieldname: "status", label: "Status", fieldtype: "Select" },
          { fieldname: "company", label: "Company", fieldtype: "Link" },
          { fieldname: "is_active", label: "Is Active", fieldtype: "Check" },
          { fieldname: "user_email", label: "User Email", fieldtype: "Email" },
          { fieldname: "mobile_no", label: "Mobile No", fieldtype: "Phone" },
        ],
        systemFields: [
          {
            jinja: "{{ doc.name }}",
            label: "Document ID",
            icon: "🆔",
          },
          {
            jinja: "{{ frappe.utils.get_url_to_form(doc.doctype, doc.name) }}",
            label: "Document Link",
            icon: "🔗",
          },
          // {
          //   // jinja: "{{ frappe.session.user }}",
          //   jinja: "{{ frappe.get_doc('User', frappe.user).full_name }}",
          //   label: "Current User Email",
          //   icon: "✉️",
          // },
          // {
          //   jinja:
          //     // '{{ frappe.db.get_value("User", frappe.session.user, "full_name") }}',
          //     //  '{{ frappe.get_doc("User", frappe.session.user).full_name }}',
          //     "{{ frappe.get_fullname() }}",
          //   label: "Current User Full Name",
          //   icon: "👤",
          // },
          {
            jinja: "{{ frappe.utils.nowdate() }}",
            label: "Current Date",
            icon: "📅",
          },
          {
            jinja: "{{ frappe.utils.now() }}",
            label: "Current Time",
            icon: "⏰",
          },
        ],
        mockData: {
          name: "SO-2026-00042",
          customer: "Acme Logistics Ltd",
          posting_date: "2026-11-02",
          grand_total: "$4,850.00",
          status: "Submitted",
          company: "Global Enterprises Inc.",
          is_active: "Yes",
          user_email: "customer@acme.com",
          mobile_no: "+254712345678",
        },
        initialSubject: "New {{Document ID}} created for {{Customer Name}}",
        initialContent: "",
        onChange: null,
      },
      options,
    );

    this.badgeMap = {};
    this.initBadgeMappings();
    this.initDOM();
    this.bindEvents();

    if (this.options.initialSubject) {
      this.setSubjectJinja(this.options.initialSubject);
    }
    if (this.options.initialContent) {
      this.setJinjaHTML(this.options.initialContent);
    } else {
      this.addBlock(
        "text",
        "<p>Hello <strong>{{Current User Full Name}}</strong>,</p><p>Please find the details for <strong>{{Document ID}}</strong> below.</p>",
      );
    }
  }

  getFieldTypeIcon(fieldtype) {
    const iconMap = {
      Data: "🔤",
      Link: "🔗",
      "Dynamic Link": "🔗",
      Currency: "💰",
      Date: "📅",
      Datetime: "📆",
      Time: "⏰",
      Select: "🔽",
      Check: "☑️",
      Int: "🔢",
      Float: "🔢",
      "Attach Image": "🖼️",
      Attach: "📎",
      Text: "📝",
      "Small Text": "📝",
      "Long Text": "📄",
      Phone: "📞",
      Email: "✉️",
      Rating: "⭐",
      Color: "🎨",
    };
    return iconMap[fieldtype] || "🏷️";
  }

  initBadgeMappings() {
    this.options.systemFields.forEach((f) => {
      this.badgeMap[`{{${f.label}}}`] = f.jinja;
    });
    this.options.docfields.forEach((f) => {
      this.badgeMap[`{{${f.label}}}`] = `{{ doc.${f.fieldname} }}`;
    });
  }

  initDOM() {
    this.container.innerHTML = `
            <div class="veb-wrapper">
                <style>
                    .veb-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; background: #f9fafb; color: #1f2937; margin: 10px 0; }
                    .veb-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #ffffff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; gap: 8px; }
                    .veb-title { font-weight: 600; font-size: 14px; color: #111827; display: flex; align-items: center; gap: 8px; }
                    .veb-header-actions { display: flex; gap: 8px; }
                    .veb-action-btn { background: #f3f4f6; border: 1px solid #d1d5db; padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 5px; cursor: pointer; color: #374151; display: inline-flex; align-items: center; gap: 6px; }
                    .veb-action-btn:hover { background: #e5e7eb; }
                    .veb-action-btn.danger { color: #dc2626; border-color: #fca5a5; background: #fef2f2; }
                    .veb-action-btn.danger:hover { background: #fee2e2; }

                    .veb-tabs { display: flex; gap: 4px; background: #f3f4f6; padding: 3px; border-radius: 6px; }
                    .veb-tab-btn { border: none; background: transparent; padding: 6px 12px; font-size: 12px; font-weight: 500; border-radius: 4px; cursor: pointer; color: #4b5563; }
                    .veb-tab-btn.active { background: #ffffff; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                    .veb-main { display: flex; height: 600px; }
                    
                    /* Sidebar Layout */
                    .veb-sidebar { width: 285px; background: #ffffff; border-right: 1px solid #e5e7eb; padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; box-sizing: border-box; }
                    
                    .veb-search-container { position: relative; }
                    .veb-search-input { width: 100%; padding: 7px 10px 7px 30px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; outline: none; transition: all 0.2s; background: #f9fafb; }
                    .veb-search-input:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                    .veb-search-icon { position: absolute; left: 9px; top: 8px; font-size: 12px; color: #9ca3af; }

                    .veb-accordion-section { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0; }
                    .veb-accordion-header { padding: 8px 12px; background: #f9fafb; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; }
                    .veb-accordion-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; }
                    .veb-accordion-body.collapsed { display: none; }
                    
                    .veb-field-item { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; padding: 6px 10px; border-radius: 4px; font-size: 11px; font-weight: 500; cursor: grab; user-select: none; display: flex; align-items: center; justify-content: space-between; }
                    .veb-field-item:hover { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }
                    .veb-field-item-left { display: flex; align-items: center; gap: 6px; }

                    .veb-block-btn { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: grab; text-align: left; color: #334155; user-select: none; flex-shrink: 0; }
                    .veb-block-btn:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }

                    /* Canvas Area & Subject Bar */
                    .veb-canvas { flex: 1; padding: 20px; background: #f9fafb; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; height: 100%; box-sizing: border-box; transition: background 0.2s; }
                    
                    .veb-subject-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
                    .veb-subject-label { font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
                    .veb-subject-input { width: 100%; min-height: 32px; padding: 6px 8px; font-size: 13px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; outline: none; box-sizing: border-box; }
                    .veb-subject-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }

                    /* Dropzone Animations */
                    .veb-drop-active { outline: 2px dashed #6366f1 !important; outline-offset: 2px; background: #eef2ff !important; animation: vebPulse 1.2s infinite ease-in-out; }
                    @keyframes vebPulse {
                        0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
                        70% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
                    }

                    .veb-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: all 0.2s; }
                    .veb-card-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; z-index: 10; }
                    .veb-card-btn { border: none; background: #f3f4f6; color: #4b5563; border-radius: 4px; width: 22px; height: 22px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; }
                    .veb-card-btn:hover { background: #e5e7eb; color: #111827; }

                    /* Rich Text Formatting Toolbar */
                    .veb-toolbar { display: flex; gap: 4px; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; align-items: center; }
                    .veb-tool-select { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; padding: 2px 4px; color: #334155; outline: none; }
                    .veb-tool-btn { background: #ffffff; border: 1px solid #cbd5e1; padding: 3px 6px; font-size: 11px; border-radius: 4px; cursor: pointer; font-weight: 600; color: #475569; display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 24px; box-sizing: border-box; }
                    .veb-tool-btn:hover { background: #f1f5f9; border-color: #94a3b8; color: #0f172a; }
                    .veb-tool-color { width: 24px; height: 24px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; background: transparent; }
                    .veb-toolbar-divider { width: 1px; height: 18px; background: #e2e8f0; margin: 0 2px; }

                    .veb-editor-area { min-height: 90px; outline: none; padding: 8px; font-size: 13px; line-height: 1.5; border: 1px solid #f1f5f9; border-radius: 4px; background: #fff; transition: background 0.2s, border 0.2s; }
                    .veb-editor-area:focus { border-color: #6366f1; }
                    
                    /* Inline Badges */
                    .veb-inline-badge { background: #e0e7ff; color: #3730a3; font-weight: 600; font-family: monospace; padding: 2px 6px; border-radius: 4px; font-size: 11px; border: 1px solid #c7d2fe; display: inline-block; user-select: all; margin: 0 2px; }

                    /* Checkbox List in Rich Text */
                    ul.veb-checklist { list-style: none; padding-left: 0; }
                    ul.veb-checklist li { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }

                    /* Table Block */
                    .veb-table-container { width: 100%; border-collapse: collapse; margin-top: 6px; }
                    .veb-table-container td { border: 1px dashed #cbd5e1; padding: 8px; min-height: 30px; background: #fafafa; transition: background 0.2s; }
                    .veb-table-container td:focus { background: #fff; border-style: solid; border-color: #6366f1; outline: none; }

                    /* Image Controls */
                    .veb-controls-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 11px; }
                    .veb-input-group { display: flex; flex-direction: column; gap: 3px; }
                    .veb-input-group label { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
                    .veb-input-group input, .veb-input-group select { padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; }
                    .veb-img-preview { max-width: 100%; height: 80px; object-fit: cover; border-radius: 4px; margin-top: 6px; border: 1px dashed #d1d5db; }

                    .veb-pane { display: none; width: 100%; height: 100%; }
                    .veb-pane.active { display: block; }
                    .veb-code-output { width: 100%; height: 550px; font-family: monospace; font-size: 12px; padding: 12px; border: none; box-sizing: border-box; background: #1e293b; color: #f8fafc; resize: none; outline: none; }
                    .veb-preview-frame { width: 100%; height: 550px; border: none; background: #ffffff; }
                </style>

                <!-- Header Navbar -->
                <div class="veb-header">
                    <span class="veb-title">Visual Email Designer</span>
                    <div class="veb-header-actions">
                        <button class="veb-action-btn" id="veb-reset-btn">🔄 Reset Default</button>
                        <button class="veb-action-btn danger" id="veb-clear-btn">🗑️ Clear All</button>
                    </div>
                    <div class="veb-tabs">
                        <button class="veb-tab-btn active" data-tab="editor">Designer</button>
                        <button class="veb-tab-btn" data-tab="code">HTML / Jinja Code</button>
                        <button class="veb-tab-btn" data-tab="preview">Live Preview</button>
                    </div>
                </div>

                <div class="veb-main">
                    <!-- Sidebar Catalog -->
                    <div class="veb-sidebar" id="veb-sidebar-catalog">
                        <div class="veb-search-container">
                            <span class="veb-search-icon">🔍</span>
                            <input type="text" class="veb-search-input" placeholder="Search fields..." id="veb-search">
                        </div>

                        <!-- System Fields Accordion -->
                        <div class="veb-accordion-section">
                            <div class="veb-accordion-header">
                                <span>System Variables</span>
                                <span class="veb-arrow">▼</span>
                            </div>
                            <div class="veb-accordion-body" id="veb-system-fields-body">
                                ${this.options.systemFields
                                  .map(
                                    (f) => `
                                    <div class="veb-field-item" draggable="true" data-label="{{${f.label}}}">
                                        <div class="veb-field-item-left"><span>${f.icon || "📌"}</span> <span>${f.label}</span></div>
                                        <span style="opacity:0.5;">＋</span>
                                    </div>
                                `,
                                  )
                                  .join("")}
                            </div>
                        </div>

                        <!-- Document Fields Accordion -->
                        <div class="veb-accordion-section">
                            <div class="veb-accordion-header">
                                <span>${this.options.doctype} Fields</span>
                                <span class="veb-arrow">▼</span>
                            </div>
                            <div class="veb-accordion-body" id="veb-doc-fields-body">
                                ${this.options.docfields
                                  .map(
                                    (f) => `
                                    <div class="veb-field-item" draggable="true" data-label="{{${f.label}}}">
                                        <div class="veb-field-item-left"><span>${this.getFieldTypeIcon(f.fieldtype)}</span> <span>${f.label}</span></div>
                                        <span style="opacity:0.5;">＋</span>
                                    </div>
                                `,
                                  )
                                  .join("")}
                            </div>
                        </div>

                        <div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Insert Blocks (Click or Drag)</div>
                        <div class="veb-block-btn" draggable="true" data-block-type="text" id="veb-add-text-btn"><span>📝 Rich Text Block</span> <span style="opacity:0.4;">⋮⋮</span></div>
                        <div class="veb-block-btn" draggable="true" data-block-type="image" id="veb-add-img-btn"><span>🖼️ Custom Image</span> <span style="opacity:0.4;">⋮⋮</span></div>
                        <div class="veb-block-btn" draggable="true" data-block-type="button" id="veb-add-btn-btn"><span>🔘 View Document Button</span> <span style="opacity:0.4;">⋮⋮</span></div>
                        <div class="veb-block-btn" draggable="true" data-block-type="table" id="veb-add-table-btn"><span>📊 Table Grid Block</span> <span style="opacity:0.4;">⋮⋮</span></div>
                        <div class="veb-block-btn" draggable="true" data-block-type="divider" id="veb-add-divider-btn"><span>➖ Divider Line</span> <span style="opacity:0.4;">⋮⋮</span></div>
                    </div>

                    <!-- Designer Canvas Pane -->
                    <div class="veb-pane active" id="pane-editor">
                        <div class="veb-canvas" id="veb-canvas">
                            <!-- Email Subject Section -->
                            <div class="veb-subject-card">
                                <div class="veb-subject-label">📧 Email Subject Line</div>
                                <div class="veb-subject-input" contenteditable="true" id="veb-subject-editor" placeholder="Enter subject line or drop variables here..."></div>
                            </div>
                            <div id="veb-blocks-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
                        </div>
                    </div>

                    <!-- Code Output Pane -->
                    <div class="veb-pane" id="pane-code">
                        <textarea class="veb-code-output" id="veb-code-view" readonly></textarea>
                    </div>

                    <!-- Live Preview Pane -->
                    <div class="veb-pane" id="pane-preview">
                        <iframe class="veb-preview-frame" id="veb-preview-iframe"></iframe>
                    </div>
                </div>
            </div>
        `;
  }

  bindEvents() {
    const root = this.container;
    const canvas = root.querySelector("#veb-canvas");
    const sidebar = root.querySelector("#veb-sidebar-catalog");
    const subjectEditor = root.querySelector("#veb-subject-editor");

    sidebar.addEventListener("dragover", (e) => e.preventDefault());
    sidebar.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Tab navigation
    root.querySelectorAll(".veb-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        root
          .querySelectorAll(".veb-tab-btn")
          .forEach((b) => b.classList.remove("active"));
        root
          .querySelectorAll(".veb-pane")
          .forEach((p) => p.classList.remove("active"));

        const tab = e.target.getAttribute("data-tab");
        e.target.classList.add("active");
        root.querySelector(`#pane-${tab}`).classList.add("active");

        if (tab === "code") {
          root.querySelector("#veb-code-view").value = this.getJinjaHTML();
        } else if (tab === "preview") {
          this.renderPreview();
        }
      });
    });

    // Reset & Clear
    root.querySelector("#veb-reset-btn").addEventListener("click", () => {
      this.setSubjectJinja("New {{Document ID}} created for {{Customer Name}}");
      this.setJinjaHTML(
        "<p>Hello <strong>{{Current User Full Name}}</strong>,</p><p>Please find the details for <strong>{{Document ID}}</strong> below.</p>",
      );
    });
    root.querySelector("#veb-clear-btn").addEventListener("click", () => {
      root.querySelector("#veb-blocks-container").innerHTML = "";
      subjectEditor.innerHTML = "";
      this.triggerChange();
    });

    // Subject dropzone
    subjectEditor.addEventListener("dragover", (e) => {
      e.preventDefault();
      subjectEditor.classList.add("veb-drop-active");
    });
    subjectEditor.addEventListener("dragleave", () =>
      subjectEditor.classList.remove("veb-drop-active"),
    );
    subjectEditor.addEventListener("drop", (e) => {
      subjectEditor.classList.remove("veb-drop-active");
      const badgeLabel = e.dataTransfer.getData("text/plain");
      if (badgeLabel && badgeLabel.startsWith("{{")) {
        e.preventDefault();
        const badgeSpan = document.createElement("span");
        badgeSpan.className = "veb-inline-badge";
        badgeSpan.contentEditable = "false";
        badgeSpan.textContent = badgeLabel;

        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.insertNode(badgeSpan);
        } else {
          subjectEditor.appendChild(badgeSpan);
        }
        this.triggerChange();
      }
    });
    subjectEditor.addEventListener("input", () => this.triggerChange());

    // Accordion Handlers
    root.querySelectorAll(".veb-accordion-header").forEach((header) => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling;
        body.classList.toggle("collapsed");
        header.querySelector(".veb-arrow").textContent =
          body.classList.contains("collapsed") ? "►" : "▼";
      });
    });

    // Search Filter
    root.querySelector("#veb-search").addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      root.querySelectorAll(".veb-field-item").forEach((item) => {
        const text = item.getAttribute("data-label").toLowerCase();
        item.style.display = text.includes(query) ? "flex" : "none";
      });
    });

    // Click Add Block Handlers
    root
      .querySelector("#veb-add-text-btn")
      .addEventListener("click", () => this.addBlock("text"));
    root
      .querySelector("#veb-add-img-btn")
      .addEventListener("click", () => this.addBlock("image"));
    root
      .querySelector("#veb-add-btn-btn")
      .addEventListener("click", () => this.addBlock("button"));
    root
      .querySelector("#veb-add-table-btn")
      .addEventListener("click", () => this.addBlock("table"));
    root
      .querySelector("#veb-add-divider-btn")
      .addEventListener("click", () => this.addBlock("divider"));

    // Drag start for sidebar fields and block buttons
    root.querySelectorAll(".veb-field-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", item.getAttribute("data-label"));
        e.dataTransfer.setData("type", "badge");
      });
    });

    root.querySelectorAll(".veb-block-btn").forEach((btn) => {
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData(
          "block-type",
          btn.getAttribute("data-block-type"),
        );
        e.dataTransfer.setData("type", "block");
      });
    });

    // Canvas dropzone
    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.target === canvas || e.target.id === "veb-blocks-container") {
        canvas.classList.add("veb-drop-active");
      }
    });
    canvas.addEventListener("dragleave", () =>
      canvas.classList.remove("veb-drop-active"),
    );
    canvas.addEventListener("drop", (e) => {
      canvas.classList.remove("veb-drop-active");
      const dragType = e.dataTransfer.getData("type");
      if (dragType === "block") {
        e.preventDefault();
        const blockType = e.dataTransfer.getData("block-type");
        if (blockType) this.addBlock(blockType);
      }
    });
  }

  addBlock(type, content = "") {
    const blocksContainer = this.container.querySelector(
      "#veb-blocks-container",
    );
    const card = document.createElement("div");
    card.className = "veb-card";
    card.setAttribute("draggable", "true");

    let bodyHTML = "";
    if (type === "text") {
      bodyHTML = `
                <div class="veb-toolbar">
                    <select class="veb-tool-select veb-tool-format" title="Text Style">
                        <option value="p">Normal</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="h4">Heading 4</option>
                        <option value="h5">Heading 5</option>
                        <option value="h6">Heading 6</option>
                    </select>

                    <select class="veb-tool-select veb-tool-size" title="Font Size">
                        <option value="3">14px (Normal)</option>
                        <option value="1">10px</option>
                        <option value="2">12px</option>
                        <option value="4">16px</option>
                        <option value="5">18px</option>
                        <option value="6">24px</option>
                        <option value="7">32px</option>
                    </select>

                    <div class="veb-toolbar-divider"></div>

                    <button type="button" class="veb-tool-btn" data-cmd="bold" title="Bold"><b>B</b></button>
                    <button type="button" class="veb-tool-btn" data-cmd="italic" title="Italic"><i>I</i></button>
                    <button type="button" class="veb-tool-btn" data-cmd="underline" title="Underline"><u>U</u></button>
                    <button type="button" class="veb-tool-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>

                    <div class="veb-toolbar-divider"></div>

                    <input type="color" class="veb-tool-color veb-tool-forecolor" title="Text Color" value="#1f2937">
                    <input type="color" class="veb-tool-color veb-tool-hilitecolor" title="Highlight / Background Color" value="#ffffff">

                    <div class="veb-toolbar-divider"></div>

                    <button type="button" class="veb-tool-btn veb-tool-link" title="Insert Link">🔗</button>
                    <button type="button" class="veb-tool-btn veb-tool-inline-img" title="Insert Inline Image">🖼️</button>

                    <div class="veb-toolbar-divider"></div>

                    <button type="button" class="veb-tool-btn" data-cmd="insertOrderedList" title="Ordered List">1.</button>
                    <button type="button" class="veb-tool-btn" data-cmd="insertUnorderedList" title="Unordered List">•</button>
                    <button type="button" class="veb-tool-btn veb-tool-checklist" title="Checkbox List">☑</button>

                    <div class="veb-toolbar-divider"></div>

                    <button type="button" class="veb-tool-btn" data-cmd="justifyLeft" title="Align Left">⬅️</button>
                    <button type="button" class="veb-tool-btn" data-cmd="justifyCenter" title="Align Center">↔️</button>
                    <button type="button" class="veb-tool-btn" data-cmd="justifyRight" title="Align Right">➡️</button>
                    <button type="button" class="veb-tool-btn" data-cmd="justifyFull" title="Justify">↔</button>

                    <div class="veb-toolbar-divider"></div>

                    <button type="button" class="veb-tool-btn" data-cmd="indent" title="Indent">⏩</button>
                    <button type="button" class="veb-tool-btn" data-cmd="outdent" title="Outdent">⏪</button>

                    <div class="veb-toolbar-divider"></div>

                    <button type="button" class="veb-tool-btn" data-cmd="formatBlock" data-val="pre" title="Code Block">&lt;/&gt;</button>
                    <button type="button" class="veb-tool-btn" data-cmd="formatBlock" data-val="blockquote" title="Quote">”</button>
                    <button type="button" class="veb-tool-btn" data-cmd="insertHorizontalRule" title="Horizontal Line">―</button>
                    <button type="button" class="veb-tool-btn veb-tool-inline-table" title="Insert Table Grid">📊</button>

                    <div class="veb-toolbar-divider"></div>
                    <button type="button" class="veb-tool-btn" data-cmd="removeFormat" title="Clear Formatting">🧹</button>
                </div>
                <div class="veb-editor-area" contenteditable="true" placeholder="Type message text here...">${content || "<p>Type message text here...</p>"}</div>
            `;
    } else if (type === "image") {
      bodyHTML = `
                <div class="veb-image-block">
                    <div class="veb-input-group">
                        <label>Image Source URL</label>
                        <input type="text" class="veb-img-url" value="https://via.placeholder.com/600x180?text=Company+Banner">
                    </div>
                    <div class="veb-controls-grid">
                        <div class="veb-input-group">
                            <label>Width</label>
                            <input type="text" class="veb-img-width" value="100%">
                        </div>
                        <div class="veb-input-group">
                            <label>Alignment</label>
                            <select class="veb-img-align">
                                <option value="center">Center</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                    </div>
                    <img src="https://via.placeholder.com/600x180?text=Company+Banner" class="veb-img-preview">
                </div>
            `;
    } else if (type === "button") {
      bodyHTML = `
                <div class="veb-button-block">
                    <div class="veb-controls-grid">
                        <div class="veb-input-group">
                            <label>Button Text</label>
                            <input type="text" class="veb-btn-label" value="View Document Details">
                        </div>
                        <div class="veb-input-group">
                            <label>Button Color</label>
                            <input type="color" class="veb-btn-bg" value="#2563eb">
                        </div>
                    </div>
                </div>
            `;
    } else if (type === "table") {
      bodyHTML = `
                <div class="veb-table-block">
                    <div style="font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 4px;">Table Grid (Drop variables into cells)</div>
                    <table class="veb-table-container">
                        <tr>
                            <td contenteditable="true">Item / Field</td>
                            <td contenteditable="true">Description / Value</td>
                        </tr>
                        <tr>
                            <td contenteditable="true">{{Document ID}}</td>
                            <td contenteditable="true">{{Grand Total}}</td>
                        </tr>
                    </table>
                </div>
            `;
    } else if (type === "divider") {
      bodyHTML = `<div style="padding: 10px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;" /></div>`;
    }

    card.innerHTML = `
            <div class="veb-card-actions">
                <button class="veb-card-btn veb-move-up" title="Move Up">▲</button>
                <button class="veb-card-btn veb-move-down" title="Move Down">▼</button>
                <button class="veb-card-btn veb-delete" title="Delete" style="color: #ef4444;">✕</button>
            </div>
            ${bodyHTML}
        `;

    blocksContainer.appendChild(card);
    this.bindBlockEvents(card, type);
    this.triggerChange();
  }

  bindBlockEvents(card, type) {
    card.querySelector(".veb-delete").addEventListener("click", () => {
      card.remove();
      this.triggerChange();
    });
    card.querySelector(".veb-move-up").addEventListener("click", () => {
      if (card.previousElementSibling)
        card.parentNode.insertBefore(card, card.previousElementSibling);
      this.triggerChange();
    });
    card.querySelector(".veb-move-down").addEventListener("click", () => {
      if (card.nextElementSibling)
        card.parentNode.insertBefore(card.nextElementSibling, card);
      this.triggerChange();
    });

    card.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      this.draggingCard = card;
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (this.draggingCard && this.draggingCard !== card) {
        card.classList.add("veb-drop-active");
      }
    });
    card.addEventListener("dragleave", () =>
      card.classList.remove("veb-drop-active"),
    );
    card.addEventListener("drop", (e) => {
      card.classList.remove("veb-drop-active");
      if (this.draggingCard && this.draggingCard !== card) {
        e.preventDefault();
        card.parentNode.insertBefore(this.draggingCard, card);
        this.triggerChange();
      }
    });

    if (type === "text") {
      card.querySelector(".veb-tool-format").addEventListener("change", (e) => {
        document.execCommand("formatBlock", false, e.target.value);
        this.triggerChange();
      });
      card.querySelector(".veb-tool-size").addEventListener("change", (e) => {
        document.execCommand("fontSize", false, e.target.value);
        this.triggerChange();
      });
      card
        .querySelector(".veb-tool-forecolor")
        .addEventListener("input", (e) => {
          document.execCommand("foreColor", false, e.target.value);
          this.triggerChange();
        });
      card
        .querySelector(".veb-tool-hilitecolor")
        .addEventListener("input", (e) => {
          document.execCommand("hiliteColor", false, e.target.value);
          this.triggerChange();
        });
      card.querySelector(".veb-tool-link").addEventListener("click", () => {
        const url = prompt("Enter hyperlink URL:", "https://");
        if (url) document.execCommand("createLink", false, url);
        this.triggerChange();
      });
      card
        .querySelector(".veb-tool-inline-img")
        .addEventListener("click", () => {
          const url = prompt(
            "Enter Image URL:",
            "https://via.placeholder.com/150",
          );
          if (url) document.execCommand("insertImage", false, url);
          this.triggerChange();
        });
      card
        .querySelector(".veb-tool-checklist")
        .addEventListener("click", () => {
          document.execCommand(
            "insertHTML",
            false,
            '<ul class="veb-checklist"><li><input type="checkbox"> Task item</li></ul>',
          );
          this.triggerChange();
        });
      card
        .querySelector(".veb-tool-inline-table")
        .addEventListener("click", () => {
          const tableHTML =
            '<table class="veb-table-container"><tr><td contenteditable="true">Col 1</td><td contenteditable="true">Col 2</td></tr></table>';
          document.execCommand("insertHTML", false, tableHTML);
          this.triggerChange();
        });
      card.querySelectorAll(".veb-tool-btn[data-cmd]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cmd = btn.getAttribute("data-cmd");
          const val = btn.getAttribute("data-val") || null;
          document.execCommand(cmd, false, val);
          this.triggerChange();
        });
      });
    }

    if (type === "text" || type === "table") {
      const editables = card.querySelectorAll('[contenteditable="true"]');
      editables.forEach((area) => {
        area.addEventListener("dragover", (e) => {
          e.preventDefault();
          area.classList.add("veb-drop-active");
        });
        area.addEventListener("dragleave", () =>
          area.classList.remove("veb-drop-active"),
        );
        area.addEventListener("drop", (e) => {
          area.classList.remove("veb-drop-active");
          const badgeLabel = e.dataTransfer.getData("text/plain");
          if (badgeLabel && badgeLabel.startsWith("{{")) {
            e.preventDefault();
            e.stopPropagation();
            const badgeSpan = document.createElement("span");
            badgeSpan.className = "veb-inline-badge";
            badgeSpan.contentEditable = "false";
            badgeSpan.textContent = badgeLabel;

            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.insertNode(badgeSpan);
            } else {
              area.appendChild(badgeSpan);
            }
            this.triggerChange();
          }
        });
        area.addEventListener("input", () => this.triggerChange());
      });
    }

    if (type === "image") {
      const urlInput = card.querySelector(".veb-img-url");
      const preview = card.querySelector(".veb-img-preview");
      urlInput.addEventListener("input", () => {
        preview.src = urlInput.value;
        this.triggerChange();
      });
    }
  }

  getSubjectJinja() {
    const subjectEditor = this.container.querySelector("#veb-subject-editor");
    if (!subjectEditor) return "";
    let content = subjectEditor.innerHTML;
    Object.keys(this.badgeMap).forEach((label) => {
      const jinjaTag = this.badgeMap[label];
      const regex = new RegExp(
        `<span class="veb-inline-badge"[^>]*>${label}</span>`,
        "g",
      );
      content = content.replace(regex, jinjaTag);
      content = content.replaceAll(label, jinjaTag);
    });
    // Strip out any accidental HTML tags in subject line
    return content.replace(/<[^>]*>?/gm, "").trim();
  }

  setSubjectJinja(subjectContent) {
    const subjectEditor = this.container.querySelector("#veb-subject-editor");
    if (!subjectEditor || !subjectContent) return;
    let processed = subjectContent;
    Object.keys(this.badgeMap).forEach((label) => {
      const jinjaTag = this.badgeMap[label];
      const badgeHTML = `<span class="veb-inline-badge" contenteditable="false">${label}</span>`;
      processed = processed.replaceAll(jinjaTag, badgeHTML);
    });
    subjectEditor.innerHTML = processed;
  }

  getJinjaHTML() {
    let html =
      '<div style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto;">\n';

    const cards = this.container.querySelectorAll(
      "#veb-blocks-container .veb-card",
    );
    cards.forEach((card) => {
      const area = card.querySelector(".veb-editor-area");
      const imgBlock = card.querySelector(".veb-image-block");
      const btnBlock = card.querySelector(".veb-button-block");
      const tableBlock = card.querySelector(".veb-table-block");
      const divider = card.querySelector("hr");

      if (area) {
        let content = area.innerHTML;
        Object.keys(this.badgeMap).forEach((label) => {
          const jinjaTag = this.badgeMap[label];
          const regex = new RegExp(
            `<span class="veb-inline-badge"[^>]*>${label}</span>`,
            "g",
          );
          content = content.replace(regex, jinjaTag);
          content = content.replaceAll(label, jinjaTag);
        });
        html += `  <div style="margin-bottom: 14px;">${content}</div>\n`;
      } else if (imgBlock) {
        const src = imgBlock.querySelector(".veb-img-url").value;
        const width = imgBlock.querySelector(".veb-img-width").value;
        const align = imgBlock.querySelector(".veb-img-align").value;
        html += `  <div style="text-align: ${align}; margin-bottom: 14px;"><img src="${src}" style="max-width: ${width}; height: auto; border-radius: 4px;" /></div>\n`;
      } else if (btnBlock) {
        const label = btnBlock.querySelector(".veb-btn-label").value;
        const bg = btnBlock.querySelector(".veb-btn-bg").value;
        html += `  <div style="text-align: center; margin: 20px 0;"><a href="{{frappe.utils.get_url_to_form(doc.doctype, doc.name)}}" style="background-color: ${bg}; color: #ffffff; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">${label}</a></div>\n`;
      } else if (tableBlock) {
        let tableHtml = tableBlock.querySelector("table").outerHTML;
        Object.keys(this.badgeMap).forEach((label) => {
          const jinjaTag = this.badgeMap[label];
          tableHtml = tableHtml.replaceAll(label, jinjaTag);
        });
        tableHtml = tableHtml.replace(/contenteditable="true"/g, "");
        html += `  <div style="margin-bottom: 14px;">${tableHtml}</div>\n`;
      } else if (divider) {
        html += `  <div style="margin: 14px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;" /></div>\n`;
      }
    });

    html += "</div>";
    return html;
  }

  setJinjaHTML2(htmlContent) {
    if (!htmlContent) return;
    const blocksContainer = this.container.querySelector(
      "#veb-blocks-container",
    );
    blocksContainer.innerHTML = "";
    let processedHTML = htmlContent;
    Object.keys(this.badgeMap).forEach((label) => {
      const jinjaTag = this.badgeMap[label];
      const badgeHTML = `<span class="veb-inline-badge" contenteditable="false">${label}</span>`;
      processedHTML = processedHTML.replaceAll(jinjaTag, badgeHTML);
    });
    this.addBlock("text", processedHTML);
  }

  setJinjaHTML(htmlContent) {
    if (!htmlContent) return;
    const blocksContainer = this.container.querySelector(
      "#veb-blocks-container",
    );
    blocksContainer.innerHTML = "";

    let processedHTML = htmlContent.trim();

    // 1. Convert Jinja tags back to human-readable badge pills
    Object.keys(this.badgeMap).forEach((label) => {
      const jinjaTag = this.badgeMap[label];
      const badgeHTML = `<span class="veb-inline-badge" contenteditable="false">${label}</span>`;
      processedHTML = processedHTML.replaceAll(jinjaTag, badgeHTML);
    });

    // 2. Recursively strip outer template and block wrapper divs to prevent nesting loops
    for (let i = 0; i < 20; i++) {
      const trimmed = processedHTML.trim();
      if (
        (trimmed.startsWith('<div style="font-family: Arial') ||
          trimmed.startsWith('<div style="margin-bottom:')) &&
        trimmed.endsWith("</div>")
      ) {
        const firstCloseIdx = trimmed.indexOf(">");
        if (firstCloseIdx !== -1) {
          processedHTML = trimmed
            .substring(firstCloseIdx + 1, trimmed.length - 6)
            .trim();
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // 3. Load the clean inner content into the rich text block
    this.addBlock("text", processedHTML);
  }

  renderPreview() {
    let subjectCompiled = this.getSubjectJinja();
    let compiled = this.getJinjaHTML();

    this.options.docfields.forEach((f) => {
      const val = this.options.mockData[f.fieldname] || `[${f.label}]`;
      compiled = compiled.replaceAll(`{{ doc.${f.fieldname} }}`, val);
      subjectCompiled = subjectCompiled.replaceAll(
        `{{ doc.${f.fieldname} }}`,
        val,
      );
    });

    const doctypeSlug = (this.options.doctype || "sales-order")
      .toLowerCase()
      .replaceAll(" ", "-");
    const fullDocURL = `${this.options.baseUrl}/app/${doctypeSlug}/${this.options.docname || "SO-2026-00042"}`;

    compiled = compiled.replaceAll(
      "{{ frappe.utils.get_url_to_form(doc.doctype, doc.name) }}",
      fullDocURL,
    );
    compiled = compiled.replaceAll(
      "{{ frappe.session.user }}",
      "john.doe@example.com",
    );
    compiled = compiled.replaceAll("{{ frappe.user.full_name }}", "John Doe");
    compiled = compiled.replaceAll(
      "{{ frappe.utils.nowdate() }}",
      "2026-11-02",
    );

    subjectCompiled = subjectCompiled.replaceAll(
      "{{ frappe.session.user }}",
      "john.doe@example.com",
    );
    subjectCompiled = subjectCompiled.replaceAll(
      "{{ frappe.user.full_name }}",
      "John Doe",
    );
    subjectCompiled = subjectCompiled.replaceAll(
      "{{ frappe.utils.nowdate() }}",
      "2026-11-02",
    );

    const iframe = this.container.querySelector("#veb-preview-iframe");
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
            <html>
                <head><style>body { font-family: Arial, sans-serif; padding: 20px; margin: 0; background: #ffffff; }</style></head>
                <body>
                    <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px; margin-bottom: 16px; border-radius: 6px;">
                        <strong style="font-size: 11px; color: #64748b; text-transform: uppercase; display: block;">Subject:</strong>
                        <span style="font-size: 15px; font-weight: bold; color: #0f172a;">${subjectCompiled}</span>
                    </div>
                    ${compiled}
                </body>
            </html>
        `);
    doc.close();
  }

  triggerChange() {
    if (typeof this.options.onChange === "function") {
      this.options.onChange({
        subject: this.getSubjectJinja(),
        message: this.getJinjaHTML(),
      });
    }
  }
}

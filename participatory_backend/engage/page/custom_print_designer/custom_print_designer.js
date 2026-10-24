frappe.pages["custom-print-designer"].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Print Layout Designer"),
    single_column: true,
  });

  frappe.require(
    "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js",
    function () {
      new PrintDesigner(page);
    },
  );
};

class PrintDesigner {
  constructor(page) {
    this.page = page;
    this.selectedDocType = null;
    this.doctypeFields = [];
    this.canvasItems = [];
    this.isEditingExisting = false;
    this.originalLayoutJson = null;
    this.hasUnsavedChanges = false;

    this.render_layout();
    this.setup_toolbar();

    // Check if a DocType was passed via route parameters/arguments
    // this.handle_route_parameters();
    this.handle_passed_doctype();
  }
  a;

  handle_passed_doctype() {
    // 1. Check URL query params (e.g. ?doctype=Sales%20Invoice)
    let query_params = frappe.utils.get_query_params();
    let passed_doctype = query_params.doctype;

    // 2. Fallback to frappe.get_route_options if available
    if (!passed_doctype) {
      let route_options = frappe.route_options;
      if (route_options && route_options.doctype) {
        passed_doctype = route_options.doctype;
      }
    }

    if (passed_doctype) {
      setTimeout(() => {
        if (this.doctype_field) {
          this.doctype_field.set_value(passed_doctype);
        }
      }, 300);

      // Clear route options if set
      frappe.route_options = null;
    }
  }

  handle_route_parameters() {
    let route_options = frappe.route_options;
    // let route_options = frappe.get_route_options();
    if (route_options && route_options.doctype) {
      // Set value on the DocType link control once toolbar is initialized
      setTimeout(() => {
        if (this.doctype_field) {
          this.doctype_field.set_value(route_options.doctype);
        }
      }, 200);

      // Clear route options so refreshing doesn't perpetually lock it in if cleared manually later
      frappe.set_route_options(null);
    }
  }

  setup_toolbar() {
    let me = this;

    const $field_area = $(`
      <div
        class="row mb-3"
        style="display:flex; width:100%; gap:15px; align-items:center; padding:10px"
      >
        <div style="flex:1; min-width:0;" class="item-one"></div>
        <div style="flex:1; min-width:0;" class="item-two"></div>
        <div style="flex:1; min-width:0;" class="item-three"></div>
        <div style="flex:1; min-width:0;" class="item-four hidden"></div>
        <div style="flex:0.8; min-width:0; display:flex; align-items:center; padding-top:15px;" class="item-five hidden"></div> 
      </div>
    `);

    $(this.page.body).prepend($field_area);

    this.doctype_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-one"),
      df: {
        fieldname: "doctype_select",
        label: __("Select DocType"),
        fieldtype: "Link",
        options: "DocType",
        reqd: 1,
        get_query: function () {
          return { filters: { custom: 1 } };
        },
        change() {
          me.selectedDocType = this.get_value();
          me.load_doctype_fields();
          me.update_existing_formats_query();
          me.mark_unsaved();
        },
      },
      render_input: true,
    });

    this.existing_format_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-two"),
      df: {
        fieldname: "existing_format",
        label: __("Load Existing Format"),
        fieldtype: "Link",
        options: "Print Format",
        placeholder: "Select to edit...",
        get_query: function () {
          return {
            filters: {
              doc_type: me.selectedDocType || "",
              custom_format: 1,
            },
          };
        },
        change() {
          let format_name = this.get_value();
          if (format_name) {
            me.load_existing_format_data(format_name);
          } else {
            me.isEditingExisting = false;
            me.originalLayoutJson = null;
            $("#reset-fields-btn").hide();
          }
        },
      },
      render_input: true,
    });

    this.format_name_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-three"),
      df: {
        fieldname: "format_name",
        label: __("Format Name"),
        fieldtype: "Data",
        placeholder: "My Custom Print Layout",
        reqd: 1,
        change() {
          me.mark_unsaved();
        },
      },
      render_input: true,
    });

    this.letter_head_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-four"),
      df: {
        fieldname: "letter_head",
        label: __("Letter Head"),
        fieldtype: "Link",
        options: "Letter Head",
        placeholder: "Select Letter Head",
        change() {
          me.mark_unsaved();
        },
      },
      render_input: true,
    });

    $field_area.find(".item-five").html(`
      <div class="form-check">
        <input type="checkbox" class="form-check-input" id="setting-is-disabled">
        <label class="form-check-label font-weight-bold small" for="setting-is-disabled">Is Disabled</label>
      </div>
    `);

    $("#setting-is-disabled").on("change", () => this.mark_unsaved());

    this.page.set_primary_action(__("Save Print Format"), () =>
      this.save_layout(),
    );
  }

  mark_unsaved() {
    if (!this.hasUnsavedChanges) {
      this.hasUnsavedChanges = true;
      let $titleArea = $(this.page.wrapper).find(".title-text");
      if ($titleArea.find(".unsaved-badge").length === 0) {
        $titleArea.append(
          ' <span class="unsaved-badge text-danger font-weight-normal" style="font-size: 12px; margin-left: 10px;">(Not saved)</span>',
        );
      }
    }
  }

  mark_saved() {
    this.hasUnsavedChanges = false;
    $(this.page.wrapper).find(".unsaved-badge").remove();
  }

  update_existing_formats_query() {
    if (this.existing_format_field) {
      this.existing_format_field.set_value("");
    }
    this.isEditingExisting = false;
    this.originalLayoutJson = null;
    $("#reset-fields-btn").hide();
  }

  load_existing_format_data(format_name) {
    let me = this;
    frappe.db.get_doc("Print Format", format_name).then((doc) => {
      if (!doc) return;

      me.isEditingExisting = true;
      me.originalLayoutJson = doc.raw_commands || null;
      $("#reset-fields-btn").show();

      me.format_name_field.set_value(doc.name);
      if (doc.letter_head) {
        me.letter_head_field.set_value(doc.letter_head);
      }

      if (doc.disabled !== undefined)
        $("#setting-is-disabled").prop("checked", doc.disabled);
      if (doc.margin_top !== undefined)
        $("#setting-margin-top").val(doc.margin_top);
      if (doc.margin_bottom !== undefined)
        $("#setting-margin-bottom").val(doc.margin_bottom);
      if (doc.margin_left !== undefined)
        $("#setting-margin-left").val(doc.margin_left);
      if (doc.margin_right !== undefined)
        $("#setting-margin-right").val(doc.margin_right);
      if (doc.page_number !== undefined)
        $("#setting-page-number").val(doc.page_number);

      let $canvas = $("#canvas");
      $canvas.empty();
      $("#canvas-placeholder").hide();

      if (!doc.raw_commands) {
        frappe.msgprint(
          __("This format does not contain structured drag-and-drop commands."),
        );
        return;
      }

      let layout = JSON.parse(doc.raw_commands);
      layout.forEach((item) => {
        let $renderedItem = me.rebuild_canvas_item_from_json(item);
        if ($renderedItem) {
          $canvas.append($renderedItem);
        }
      });

      me.init_nested_sortables();
      me.mark_saved();
      frappe.show_alert({
        message: __("Print Format Loaded Successfully"),
        indicator: "green",
      });
    });
  }

  rebuild_canvas_item_from_json(item) {
    let me = this;
    let wrapper = document.createElement("div");
    let alignment = item.alignment || "Left";
    let styleConfig = item.style || {};

    if (item.type === "section") {
      // ... existing section rebuild logic ...
      wrapper.className = "canvas-section";
      wrapper.dataset.type = "section";
      wrapper.dataset.alignment = alignment;
      wrapper.dataset.style = JSON.stringify(styleConfig);

      let colCount = item.columns ? item.columns.length : 2;
      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <input type="text" class="form-control form-control-sm font-weight-bold section-title-input" value="${item.label || "Section Title"}" style="flex: 2; margin-right: 10px;">
          <div style="display: flex; gap: 6px; align-items: center;">
            <label class="text-muted small mb-0" style="white-space: nowrap;">Cols:</label>
            <input type="number" min="1" max="4" value="${colCount}" class="form-control form-control-sm section-cols-input" style="width: 50px;">
            <button class="action-icon-btn settings-btn" title="Settings">⚙</button>
            <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
          </div>
        </div>
        <div class="section-columns"></div>
      `;
      me.render_section_columns(wrapper, colCount, item.columns);
      $(wrapper)
        .find(".settings-btn")
        .on("click", () => me.open_block_settings_dialog(wrapper, "Section"));
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    } else if (
      item.type === "heading" ||
      item.type === "html_block" ||
      item.type === "qrcode_block" ||
      item.type === "timestamp_block" ||
      item.type === "current_user_block" ||
      item.type === "spacer"
    ) {
      // ... handled via your existing block rebuilds ...
      return me.create_canvas_element(
        item.type,
        item.label || item.text,
        "",
        null,
      );
    } else if (item.type === "field" || item.type === "table") {
      let fieldItem = me.create_canvas_field_item(
        item.type,
        item.label,
        item.fieldname,
        alignment,
        styleConfig,
        item.fieldtype || "Data",
      );
      if (item.columns && item.columns.length) {
        fieldItem.dataset.columns = JSON.stringify(item.columns);
      }
      return fieldItem;
    }
    return wrapper;
  }

  render_layout() {
    let me = this;
    this.page.main.html(`
            <style>
                .designer-wrapper { display: flex; flex-direction: column; height: calc(100vh - 140px); gap: 15px; padding: 10px; }
                .designer-container { display: flex; gap: 20px; flex: 1; overflow: hidden; }
                .palette { width: 330px; background: #f8f9fa; border: 1px solid #d1d8dd; border-radius: 8px; padding: 15px; overflow-y: auto; }
                .canvas-wrapper { flex: 1; background: #eaeded; border: 1px solid #d1d8dd; border-radius: 8px; padding: 20px; overflow-y: auto; display: flex; justify-content: center; align-items: flex-start; }
                .paper-canvas { width: 100%; max-width: 750px; min-height: 700px; height: auto; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 4px; padding: 30px; margin-bottom: 40px; }
                .drag-item { background: #fff; border: 1px solid #d1d8dd; border-radius: 4px; padding: 8px 10px; margin-bottom: 6px; cursor: grab; font-weight: 500; font-size: 13px; }
                .canvas-section { border: 2px dashed #cbd5e0; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: #f7fafc; position: relative; }
                
                .action-icon-btn { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; font-size: 12px; padding: 0; line-height: 1; }
                .action-icon-btn.remove-btn { color: #e53e3e; border-color: #feb2b2; }
                .action-icon-btn.remove-btn:hover { background: #fff5f5; }
                .action-icon-btn.settings-btn:hover { background: #edf2f7; }

                .section-columns { display: flex; gap: 15px; margin-top: 10px; }
                .column-dropzone { flex: 1; min-height: 80px; background: #fff; border: 1px dashed #a0aec0; border-radius: 4px; padding: 10px; }
                .canvas-field-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-bottom: 6px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
                .ghost-class { opacity: 0.4; background: #edf2f7; }

                .palette-section-header { font-weight: bold; color: #4a5568; text-transform: uppercase; margin-bottom: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 12px; user-select: none; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px; }
                .palette-section-header:hover { color: #2d3748; }
            </style>

            <div class="designer-wrapper">
                <div class="designer-container">
                    <div class="palette">
                        <div class="palette-section-header" id="toggle-structure-palette" style="border-top: none; margin-top: 0; padding-top: 0;">
                            <span>${__("Structure Elements")}</span>
                            <span id="structure-toggle-icon">▼</span>
                        </div>
                        <div id="static-elements-container">
                            <div id="static-elements" class="mb-2">
                                <div class="drag-item" data-type="section" style="background: #ebf8ff; border-color: #bee3f8;">${__("📁 Section Block")}</div>
                                <div class="drag-item" data-type="heading">${__("📌 Title / Heading")}</div>
                                <div class="drag-item" data-type="html_block" style="background: #fef3c7; border-color: #fde68a;">${__("⚡ Custom HTML Block")}</div>
                                <div class="drag-item" data-type="qrcode_block" style="background: #ede9fe; border-color: #ddd6fe;">${__("📱 QR Code Block")}</div>
                                <div class="drag-item" data-type="timestamp_block" style="background: #e2e8f0; border-color: #cbd5e0;">${__("🕒 Timestamp Block")}</div>
                                <div class="drag-item" data-type="current_user_block" style="background: #e2e8f0; border-color: #cbd5e0;">${__("👤 Current User Block")}</div>
                                <div class="drag-item" data-type="spacer">${__("📏 Spacer Block")}</div>
                            </div>
                        </div>

                        <div class="palette-section-header" id="toggle-fields-palette">
                            <span>${__("DocType Fields")}</span>
                            <span id="fields-toggle-icon">▼</span>
                        </div>
                        <div id="field-elements-container">
                            <div class="mb-2" style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button class="btn btn-xs btn-default" id="add-all-fields-btn" style="font-size: 11px;">➕ Add All</button>
                                <button class="btn btn-xs btn-default text-danger" id="remove-all-fields-btn" style="font-size: 11px;">🗑️ Remove All</button>
                                <button class="btn btn-xs btn-default text-warning" id="reset-fields-btn" style="font-size: 11px; display:none;">🔄 Reset</button>
                            </div>
                            <div id="field-elements">
                                <p class="text-muted small">${__("Select a DocType above to load fields")}</p>
                            </div>
                        </div>

                        <div class="palette-section-header" id="toggle-settings-palette">
                            <span>${__("Global Print Settings")}</span>
                            <span id="settings-toggle-icon">▼</span>
                        </div>
                        <div id="settings-elements-container" style="display:none; font-size: 12px; background: #edf2f7; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e0;" class="mb-2">
                            <div class="form-group mb-2">
                                <label class="text-muted mb-1 font-weight-bold">Label Width (%)</label>
                                <input type="number" id="setting-label-width" class="form-control form-control-sm" value="40" min="10" max="80">
                            </div>
                            <div class="form-group mb-2">
                                <label class="text-muted mb-1 font-weight-bold">Margins (Top, Bottom, Left, Right)</label>
                                <div style="display:flex; gap:4px;">
                                    <input type="text" id="setting-margin-top" class="form-control form-control-sm" placeholder="Top">
                                    <input type="text" id="setting-margin-bottom" class="form-control form-control-sm" placeholder="Bottom">
                                    <input type="text" id="setting-margin-left" class="form-control form-control-sm" placeholder="Left">
                                    <input type="text" id="setting-margin-right" class="form-control form-control-sm" placeholder="Right">
                                </div>
                            </div>
                            <div class="form-group mb-2">
                                <label class="text-muted mb-1 font-weight-bold">Page Numbering</label>
                                <select id="setting-page-number" class="form-control form-control-sm">
                                    <option value="">None</option>
                                    <option value="Top Right">Top Right</option>
                                    <option value="Top Center">Top Center</option>
                                    <option value="Top Left">Top Left</option>
                                    <option value="Bottom Right">Bottom Right</option>
                                    <option value="Bottom Center">Bottom Center</option>
                                    <option value="Bottom Left">Bottom Left</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="canvas-wrapper">
                        <div class="paper-canvas" id="canvas">
                            <p class="text-muted text-center mt-5" id="canvas-placeholder">${__("Drag sections, fields, or blocks here")}</p>
                        </div>
                    </div>
                </div>
            </div>
        `);

    $("#toggle-structure-palette").on("click", function () {
      let $container = $("#static-elements-container");
      let $icon = $("#structure-toggle-icon");
      if ($container.is(":visible")) {
        $container.slideUp(150);
        $icon.text("►");
      } else {
        $container.slideDown(150);
        $icon.text("▼");
      }
    });

    $("#toggle-fields-palette").on("click", function () {
      let $container = $("#field-elements-container");
      let $icon = $("#fields-toggle-icon");
      if ($container.is(":visible")) {
        $container.slideUp(150);
        $icon.text("►");
      } else {
        $container.slideDown(150);
        $icon.text("▼");
      }
    });

    $("#toggle-settings-palette").on("click", function () {
      let $container = $("#settings-elements-container");
      let $icon = $("#settings-toggle-icon");
      if ($container.is(":visible")) {
        $container.slideUp(150);
        $icon.text("►");
      } else {
        $container.slideDown(150);
        $icon.text("▼");
      }
    });

    $("#add-all-fields-btn").on("click", () => this.add_all_fields_to_canvas());

    $("#remove-all-fields-btn").on("click", () => {
      frappe.confirm(
        __("Are you sure you want to remove all elements from the canvas?"),
        () => {
          $("#canvas")
            .empty()
            .append(
              `<p class="text-muted text-center mt-5" id="canvas-placeholder">${__("Drag sections, fields, or blocks here")}</p>`,
            );
          me.mark_unsaved();
          frappe.show_alert({
            message: __("Canvas cleared"),
            indicator: "orange",
          });
        },
      );
    });

    $("#reset-fields-btn").on("click", () => {
      frappe.confirm(
        __(
          "Are you sure you want to reset changes back to the saved format state?",
        ),
        () => {
          let fmt = this.existing_format_field.get_value();
          if (fmt) this.load_existing_format_data(fmt);
        },
      );
    });

    this.init_drag_drop();
  }

  add_all_fields_to_canvas() {
    let me = this;
    if (!me.selectedDocType) {
      frappe.msgprint(__("Please select a DocType first."));
      return;
    }

    $("#canvas-placeholder").hide();
    let $canvas = $("#canvas");

    let existingFieldnames = new Set();
    $canvas.find(".canvas-field-item").each(function () {
      if (this.dataset.fieldname)
        existingFieldnames.add(this.dataset.fieldname);
    });
    $canvas.find(".column-dropzone .canvas-field-item").each(function () {
      if (this.dataset.fieldname)
        existingFieldnames.add(this.dataset.fieldname);
    });

    frappe.model.with_doctype(me.selectedDocType, () => {
      let meta = frappe.get_meta(me.selectedDocType);
      let addedCount = 0;

      meta.fields.forEach((f) => {
        if (!["Section Break", "Column Break"].includes(f.fieldtype)) {
          if (!existingFieldnames.has(f.fieldname)) {
            let itemType = "field";
            if (f.fieldtype === "Table") itemType = "table";
            // else if (f.fieldtype === "Password") itemType = "password";
            // else if (f.fieldtype === "Geolocation") itemType = "geolocation";
            // else if (f.fieldtype === "Signature") itemType = "signature";
            // else if (f.fieldtype === "Rating") itemType = "rating";

            let $fieldItem = $(
              me.create_canvas_field_item(
                itemType,
                f.label,
                f.fieldname,
                "Left",
                {},
                f.fieldtype,
              ),
            );
            $canvas.append($fieldItem);
            addedCount++;
          }
        }
      });

      if (addedCount > 0) {
        me.mark_unsaved();
        frappe.show_alert({
          message: __(`Added ${addedCount} missing fields to canvas`),
          indicator: "green",
        });
      } else {
        frappe.show_alert({
          message: __("All DocType fields are already present on the canvas"),
          indicator: "orange",
        });
      }
    });
  }

  load_doctype_fields() {
    if (!this.selectedDocType) return;

    frappe.model.with_doctype(this.selectedDocType, () => {
      let meta = frappe.get_meta(this.selectedDocType);
      let fieldsContainer = $(this.page.main).find("#field-elements");
      fieldsContainer.empty();

      meta.fields.forEach((f) => {
        if (!["Section Break", "Column Break"].includes(f.fieldtype)) {
          // let itemType = "field";
          // if (f.fieldtype === "Table") itemType = "table";
          // else if (f.fieldtype === "Password") itemType = "password";
          // else if (f.fieldtype === "Geolocation") itemType = "geolocation";
          // else if (f.fieldtype === "Signature") itemType = "signature";
          // else if (f.fieldtype === "Rating") itemType = "rating";
          let itemType = f.fieldtype === "Table" ? "table" : "field";
          let fieldType = f.fieldtype;

          fieldsContainer.append(`
            <div class="drag-item" data-fieldtype="${fieldType}" data-type="${itemType}" data-fieldname="${f.fieldname}" data-label="${f.label}">
                ${f.label} <span class="badge badge-light text-muted float-right">${f.fieldtype}</span>
            </div>
          `);
        }
      });
    });
  }

  init_drag_drop() {
    let me = this;
    let canvasEl = document.getElementById("canvas");

    new Sortable(document.getElementById("static-elements"), {
      group: { name: "shared", pull: "clone", put: false },
      sort: false,
    });

    new Sortable(document.getElementById("field-elements"), {
      group: { name: "shared", pull: "clone", put: false },
      sort: false,
    });

    new Sortable(canvasEl, {
      group: "shared",
      animation: 150,
      ghostClass: "ghost-class",
      onAdd: function (evt) {
        $("#canvas-placeholder").hide();
        let itemEl = evt.item;
        let type = itemEl.dataset.type;
        let fieldtype = itemEl.dataset.fieldtype || "Data";
        let fieldname = itemEl.dataset.fieldname || "";
        let label = itemEl.dataset.label || itemEl.innerText.trim();

        let newCanvasItem;
        if (type === "field" || type === "table") {
          newCanvasItem = me.create_canvas_field_item(
            type,
            label,
            fieldname,
            "Left",
            {},
            fieldtype,
          );
        } else {
          newCanvasItem = me.create_canvas_element(
            type,
            label,
            fieldname,
            itemEl,
          );
        }

        itemEl.replaceWith(newCanvasItem);
        me.init_nested_sortables();
        me.mark_unsaved();
      },
    });
  }

  init_nested_sortables() {
    let me = this;
    document.querySelectorAll(".column-dropzone").forEach((col) => {
      if (!col.sortableInstance) {
        col.sortableInstance = new Sortable(col, {
          group: "shared",
          animation: 150,
          ghostClass: "ghost-class",
          onAdd: function (evt) {
            let itemEl = evt.item;
            let type = itemEl.dataset.type;
            if (type === "section") {
              evt.item.remove();
              frappe.show_alert({
                message: __("Cannot drop a section inside a column."),
                indicator: "orange",
              });
              return;
            }

            let fieldname = itemEl.dataset.fieldname || "";
            let fieldtype = itemEl.dataset.fieldtype || "Data";
            let label = itemEl.dataset.label || itemEl.innerText.trim();

            let newItem = me.create_canvas_field_item(
              type,
              label,
              fieldname,
              "Left",
              {},
              fieldtype,
            );
            itemEl.replaceWith(newItem);
            me.mark_unsaved();
          },
        });
      }
    });
  }

  create_canvas_field_item(
    type,
    label,
    fieldname,
    alignment = "Left",
    styleConfig = {},
    fieldtype = "Data",
  ) {
    let me = this;
    let newItem = document.createElement("div");
    newItem.className = "canvas-field-item";
    newItem.dataset.type = type;
    newItem.dataset.fieldtype = fieldtype;
    newItem.dataset.fieldname = fieldname;
    newItem.dataset.label = label;
    newItem.dataset.alignment = alignment;
    newItem.dataset.style = JSON.stringify(styleConfig);

    let extraHtml = "";
    if (type === "table") {
      newItem.dataset.columns = JSON.stringify([]);
      extraHtml += ` <button class="btn btn-xs btn-default configure-table-btn ml-1">Columns</button>`;

      // Automatically fetch and populate default columns for the child table
      if (me.selectedDocType && fieldname) {
        frappe.model.with_doctype(me.selectedDocType, () => {
          let meta = frappe.get_meta(me.selectedDocType);
          let tableField = meta.fields.find((f) => f.fieldname === fieldname);
          if (tableField && tableField.options) {
            frappe.model.with_doctype(tableField.options, () => {
              let childMeta = frappe.get_meta(tableField.options);
              let childFields = childMeta.fields.filter(
                (f) => !["Section Break", "Column Break"].includes(f.fieldtype),
              );
              let defaultCols = childFields
                .slice(0, 5)
                .map((cf) => ({ fieldname: cf.fieldname, label: cf.label }));
              newItem.dataset.columns = JSON.stringify(defaultCols);
            });
          }
        });
      }
    }

    newItem.innerHTML = `
      <span class="field-label-text"><strong>${label}</strong> <span class="text-muted small">(${fieldtype})</span></span>
      <div style="display:flex; gap:6px; align-items:center;">
        ${extraHtml}
        <button class="action-icon-btn settings-btn ml-1" title="Settings">⚙</button>
        <button class="action-icon-btn remove-btn ml-1" title="Delete">&times;</button>
      </div>
    `;

    $(newItem)
      .find(".settings-btn")
      .on("click", () => this.open_field_settings_dialog(newItem));
    $(newItem)
      .find(".field-label-text")
      .on("dblclick", () => this.open_field_settings_dialog(newItem));
    $(newItem)
      .find(".remove-btn")
      .on("click", () => {
        newItem.remove();
        this.mark_unsaved();
      });

    if (type === "table") {
      $(newItem)
        .find(".configure-table-btn")
        .on("click", () => this.open_table_column_config(newItem, fieldname));
    }

    return newItem;
  }

  open_field_settings_dialog(itemEl) {
    let me = this;
    let currentLabel = itemEl.dataset.label;
    let currentAlign = itemEl.dataset.alignment || "Left";
    let style = JSON.parse(itemEl.dataset.style || "{}");
    let fieldType = itemEl.dataset.type;

    let d = new frappe.ui.Dialog({
      title: __("Field Settings & Styling"),
      fields: [
        {
          fieldname: "label",
          label: __("Display Label"),
          fieldtype: "Data",
          default: currentLabel,
          reqd: 1,
        },
        {
          fieldname: "alignment",
          label: __("Alignment"),
          fieldtype: "Select",
          options: "Left\nCenter\nRight",
          default: currentAlign,
        },
        { fieldtype: "Section Break", label: "Text Styling" },
        {
          fieldname: "bold",
          label: __("Bold"),
          fieldtype: "Check",
          default: style.bold ? 1 : 0,
        },
        {
          fieldname: "italic",
          label: __("Italic"),
          fieldtype: "Check",
          default: style.italic ? 1 : 0,
        },
        {
          fieldname: "underline",
          label: __("Underline"),
          fieldtype: "Check",
          default: style.underline ? 1 : 0,
        },
        {
          fieldname: "font_size",
          label: __("Font Size (numeric value)"),
          fieldtype: "Int",
          default: style.font_size ? parseInt(style.font_size) : "",
        },
        {
          fieldname: "color",
          label: __("Text Color"),
          fieldtype: "Color",
          default: style.color || "#000000",
        },
      ],
      primary_action_label: __("Save Settings"),
      primary_action(values) {
        itemEl.dataset.label = values.label;
        itemEl.dataset.alignment = values.alignment;
        itemEl.dataset.style = JSON.stringify({
          bold: values.bold,
          italic: values.italic,
          underline: values.underline,
          font_size: values.font_size ? values.font_size + "px" : "",
          color: values.color,
        });
        $(itemEl)
          .find(".field-label-text")
          .html(
            `<strong>${values.label}</strong> <span class="text-muted small">(${fieldType})</span>`,
          );
        me.mark_unsaved();
        frappe.show_alert({
          message: __("Field settings saved"),
          indicator: "green",
        });
        d.hide();
      },
    });
    d.show();
  }

  open_block_settings_dialog(wrapperEl, blockTitle) {
    let me = this;
    let currentAlign = wrapperEl.dataset.alignment || "Left";
    let style = JSON.parse(wrapperEl.dataset.style || "{}");

    let fields = [
      {
        fieldname: "alignment",
        label: __("Alignment"),
        fieldtype: "Select",
        options: "Left\nCenter\nRight",
        default: currentAlign,
      },
      { fieldtype: "Section Break", label: "Text Styling" },
      {
        fieldname: "bold",
        label: __("Bold"),
        fieldtype: "Check",
        default: style.bold ? 1 : 0,
      },
      {
        fieldname: "italic",
        label: __("Italic"),
        fieldtype: "Check",
        default: style.italic ? 1 : 0,
      },
      {
        fieldname: "underline",
        label: __("Underline"),
        fieldtype: "Check",
        default: style.underline ? 1 : 0,
      },
      {
        fieldname: "font_size",
        label: __("Font Size (numeric value)"),
        fieldtype: "Int",
        default: style.font_size ? parseInt(style.font_size) : "",
      },
      {
        fieldname: "color",
        label: __("Text Color"),
        fieldtype: "Color",
        default: style.color || "#000000",
      },
    ];

    if (wrapperEl.dataset.type === "section") {
      let $titleInput = $(wrapperEl).find(".section-title-input");
      fields.unshift({
        fieldname: "section_title",
        label: __("Section Title"),
        fieldtype: "Data",
        default: $titleInput.val() || "Section Title",
      });
    } else if (wrapperEl.dataset.type === "heading") {
      let $headingInput = $(wrapperEl).find(".heading-title-input");
      fields.unshift({
        fieldname: "heading_title",
        label: __("Heading Text"),
        fieldtype: "Data",
        default: $headingInput.val() || "",
      });
    } else if (
      ["timestamp_block", "current_user_block"].includes(wrapperEl.dataset.type)
    ) {
      fields.unshift({
        fieldname: "block_label",
        label: __("Block Label"),
        fieldtype: "Data",
        default: wrapperEl.dataset.label || "",
      });
    }

    let d = new frappe.ui.Dialog({
      title: __(`${blockTitle} Settings`),
      fields: fields,
      primary_action_label: __("Save Settings"),
      primary_action(values) {
        wrapperEl.dataset.alignment = values.alignment;
        wrapperEl.dataset.style = JSON.stringify({
          bold: values.bold,
          italic: values.italic,
          underline: values.underline,
          font_size: values.font_size ? values.font_size + "px" : "",
          color: values.color,
        });
        if (values.section_title !== undefined) {
          $(wrapperEl).find(".section-title-input").val(values.section_title);
        }
        if (values.heading_title !== undefined) {
          $(wrapperEl).find(".heading-title-input").val(values.heading_title);
        }
        if (values.block_label !== undefined) {
          wrapperEl.dataset.label = values.block_label;
          $(wrapperEl).find(".block-label-text").text(values.block_label);
        }
        me.mark_unsaved();
        frappe.show_alert({
          message: __("Block settings saved"),
          indicator: "green",
        });
        d.hide();
      },
    });
    d.show();
  }

  // Enhanced QR Code configuration supporting concatenated values and relative text labeling/positioning
  open_qrcode_config(wrapperEl) {
    let me = this;
    if (!me.selectedDocType) {
      frappe.msgprint(__("Please select a DocType first."));
      return;
    }

    frappe.model.with_doctype(me.selectedDocType, () => {
      let meta = frappe.get_meta(me.selectedDocType);

      // Fix: Removed 'undefined' description subtext by providing explicit label-only format mapping
      let fieldOptions = meta.fields
        .filter(
          (f) =>
            !["Section Break", "Column Break", "Table"].includes(f.fieldtype),
        )
        .map((f) => ({
          label: `${f.label} (${f.fieldname})`,
          value: f.fieldname,
          description: "",
        }));

      let existingConfig = JSON.parse(wrapperEl.dataset.config || "{}");

      let d = new frappe.ui.Dialog({
        title: __("Configure QR Code Content & Label"),
        fields: [
          {
            fieldname: "mode",
            label: __("Content Mode"),
            fieldtype: "Select",
            options: "Static Text\nCombined Fields\nConcatenated URL/Text",
            default: existingConfig.mode || "Static Text",
            change() {
              let val = d.get_value("mode");
              d.set_df_property("static_text", "hidden", val !== "Static Text");
              d.set_df_property(
                "selected_fields",
                "hidden",
                val !== "Combined Fields",
              );
              d.set_df_property(
                "separator",
                "hidden",
                val !== "Combined Fields",
              );
              d.set_df_property(
                "concat_template",
                "hidden",
                val !== "Concatenated URL/Text",
              );
            },
          },
          {
            fieldname: "static_text",
            label: __("Static Content / URL"),
            fieldtype: "Data",
            default: existingConfig.static_text || "",
            hidden: existingConfig.mode !== "Static Text",
          },
          {
            fieldname: "selected_fields",
            label: __("Select Fields to Combine"),
            fieldtype: "MultiSelectList",
            get_data: () => fieldOptions,
            default: existingConfig.selected_fields || [],
            hidden: existingConfig.mode !== "Combined Fields",
          },
          {
            fieldname: "separator",
            label: __("Field Separator"),
            fieldtype: "Data",
            default: existingConfig.separator || " - ",
            hidden: existingConfig.mode !== "Combined Fields",
          },
          {
            fieldname: "concat_template",
            label: __(
              "Concatenation Template (e.g. http://example.com/?d={{doc.name}})",
            ),
            fieldtype: "Data",
            default: existingConfig.concat_template || "",
            hidden: existingConfig.mode !== "Concatenated URL/Text",
          },
          { fieldtype: "Section Break", label: "Adjacent Text Label" },
          {
            fieldname: "qr_text",
            label: __("Adjacent Text"),
            fieldtype: "Data",
            default: existingConfig.qr_text || "",
          },
          {
            fieldname: "qr_text_position",
            label: __("Position Relative to QR Code"),
            fieldtype: "Select",
            options: "Top\nBottom\nLeft\nRight",
            default: existingConfig.qr_text_position || "Bottom",
          },
        ],
        primary_action_label: __("Save QR Config"),
        primary_action(values) {
          wrapperEl.dataset.config = JSON.stringify(values);
          me.mark_unsaved();
          frappe.show_alert({
            message: __("QR Code configuration saved"),
            indicator: "green",
          });
          d.hide();
        },
      });
      d.show();
    });
  }

  open_table_column_config(itemEl, tableFieldname) {
    let me = this;
    if (!me.selectedDocType) {
      frappe.msgprint(__("Please select a DocType first."));
      return;
    }

    frappe.model.with_doctype(me.selectedDocType, () => {
      let meta = frappe.get_meta(me.selectedDocType);
      let tableField = meta.fields.find((f) => f.fieldname === tableFieldname);
      if (!tableField || !tableField.options) {
        frappe.msgprint(__("Could not find table options DocType."));
        return;
      }

      frappe.model.with_doctype(tableField.options, () => {
        let childMeta = frappe.get_meta(tableField.options);
        let childFields = childMeta.fields.filter(
          (f) => !["Section Break", "Column Break"].includes(f.fieldtype),
        );
        let existingCols = JSON.parse(itemEl.dataset.columns || "[]");

        let d = new frappe.ui.Dialog({
          title: __(`Configure Columns for ${tableField.label}`),
          fields: [
            {
              fieldname: "columns_table",
              label: __("Select & Order Columns"),
              fieldtype: "Table",
              fields: [
                {
                  fieldtype: "Data",
                  fieldname: "fieldname",
                  label: "Fieldname",
                  in_list_view: 1,
                  reqd: 1,
                },
                {
                  fieldtype: "Data",
                  fieldname: "label",
                  label: "Label",
                  in_list_view: 1,
                  reqd: 1,
                },
              ],
              data: existingCols.length
                ? existingCols
                : childFields.slice(0, 5).map((cf) => ({
                    fieldname: cf.fieldname,
                    label: cf.label,
                  })),
            },
          ],
          primary_action_label: __("Save Columns"),
          primary_action(values) {
            itemEl.dataset.columns = JSON.stringify(values.columns_table);
            me.mark_unsaved();
            frappe.show_alert({
              message: __("Table columns saved successfully"),
              indicator: "green",
            });
            d.hide();
          },
        });
        d.show();
      });
    });
  }

  render_section_columns(sectionWrapper, count, existingColumnsData = null) {
    let me = this;
    let $colsContainer = $(sectionWrapper).find(".section-columns");

    let flattenedItems = [];
    $colsContainer
      .find(".column-dropzone .canvas-field-item")
      .each(function () {
        flattenedItems.push({
          type: this.dataset.type,
          fieldname: this.dataset.fieldname,
          fieldtype: this.dataset.fieldtype,
          label: this.dataset.label,
          alignment: this.dataset.alignment || "Left",
          style: JSON.parse(this.dataset.style || "{}"),
          columns: this.dataset.columns ? JSON.parse(this.dataset.columns) : [],
        });
      });

    if (
      existingColumnsData &&
      Array.isArray(existingColumnsData) &&
      flattenedItems.length === 0
    ) {
      existingColumnsData.forEach((colArray) => {
        if (Array.isArray(colArray)) {
          colArray.forEach((f) => flattenedItems.push(f));
        }
      });
    }

    $colsContainer.empty();

    for (let i = 0; i < count; i++) {
      let $col = $(`
        <div class="column-dropzone" data-col="${i}">
          <small class="text-muted">Col ${i + 1}</small>
        </div>
      `);
      $colsContainer.append($col);
    }

    flattenedItems.forEach((itemData, index) => {
      let targetColIdx = index % count;
      let $targetCol = $colsContainer.find(
        `.column-dropzone[data-col="${targetColIdx}"]`,
      );

      $targetCol.find("small").remove();
      let $fieldItem = $(
        me.create_canvas_field_item(
          itemData.type,
          itemData.label,
          itemData.fieldname,
          itemData.alignment || "Left",
          itemData.style || {},
          itemData.fieldtype || "Data",
        ),
      );
      if (itemData.columns && itemData.columns.length) {
        $fieldItem[0].dataset.columns = JSON.stringify(itemData.columns);
      }
      $targetCol.append($fieldItem);
    });

    setTimeout(() => {
      me.init_nested_sortables();
    }, 50);
  }

  create_canvas_element(type, label, fieldname, sourceEl) {
    let wrapper = document.createElement("div");
    let me = this;
    let alignment = "Left";

    if (type === "section") {
      wrapper.className = "canvas-section";
      wrapper.dataset.type = "section";
      wrapper.dataset.alignment = alignment;
      wrapper.dataset.style = JSON.stringify({});

      let defaultCols = 2;

      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <input type="text" class="form-control form-control-sm font-weight-bold section-title-input" value="Section Title" style="flex: 2; margin-right: 10px;">
          <div style="display: flex; gap: 6px; align-items: center;">
            <label class="text-muted small mb-0" style="white-space: nowrap;">Cols:</label>
            <input type="number" min="1" max="4" value="${defaultCols}" class="form-control form-control-sm section-cols-input" style="width: 50px;">
            <button class="action-icon-btn settings-btn" title="Settings">⚙</button>
            <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
          </div>
        </div>
        <div class="section-columns"></div>
      `;

      me.render_section_columns(wrapper, defaultCols);

      $(wrapper)
        .find(".section-cols-input")
        .on("change", function () {
          let val = parseInt($(this).val()) || 1;
          if (val < 1) val = 1;
          if (val > 4) val = 4;
          $(this).val(val);
          me.render_section_columns(wrapper, val);
          me.mark_unsaved();
        });

      $(wrapper)
        .find(".section-title-input")
        .on("input", () => me.mark_unsaved());
      $(wrapper)
        .find(".settings-btn")
        .on("click", () => me.open_block_settings_dialog(wrapper, "Section"));
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    } else if (type === "heading") {
      wrapper.className = "canvas-section py-2";
      wrapper.dataset.type = "heading";
      wrapper.dataset.alignment = alignment;
      wrapper.dataset.style = JSON.stringify({});
      wrapper.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items:center; gap:10px;">
          <input type="text" class="form-control form-control-sm font-weight-bold heading-title-input" value="${sourceEl ? sourceEl.innerText.trim() : label}" style="flex:1;">
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="action-icon-btn settings-btn" title="Settings">⚙</button>
            <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
          </div>
        </div>
      `;
      $(wrapper)
        .find(".heading-title-input")
        .on("input", () => me.mark_unsaved());
      $(wrapper)
        .find(".settings-btn")
        .on("click", () => me.open_block_settings_dialog(wrapper, "Heading"));
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    } else if (type === "html_block") {
      wrapper.className = "canvas-section py-2";
      wrapper.dataset.type = "html_block";
      wrapper.dataset.alignment = alignment;
      wrapper.dataset.style = JSON.stringify({});
      wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <label class="text-muted small font-weight-bold mb-0">Custom HTML / Jinja</label>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="action-icon-btn settings-btn" title="Settings">⚙</button>
            <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
          </div>
        </div>
        <textarea class="form-control form-control-sm html-content-input" rows="3" placeholder="Enter custom HTML or Jinja tags here...">${label && label !== "⚡ Custom HTML Block" ? label : ""}</textarea>
      `;
      $(wrapper)
        .find(".html-content-input")
        .on("input", () => me.mark_unsaved());
      $(wrapper)
        .find(".settings-btn")
        .on("click", () =>
          me.open_block_settings_dialog(wrapper, "Custom HTML"),
        );
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    } else if (type === "qrcode_block") {
      wrapper.className = "canvas-section py-2";
      wrapper.dataset.type = "qrcode_block";
      wrapper.dataset.alignment = alignment;
      wrapper.dataset.style = JSON.stringify({});
      wrapper.dataset.config = JSON.stringify({
        mode: "Static Text",
        static_text: "https://example.com",
      });
      wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>QR Code Block</strong> <span class="text-muted small">(static)</span>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <button class="btn btn-xs btn-default configure-qr-btn">Configure</button>
            <button class="action-icon-btn settings-btn" title="Settings">⚙</button>
            <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
          </div>
        </div>
      `;
      $(wrapper)
        .find(".configure-qr-btn")
        .on("click", () => me.open_qrcode_config(wrapper));
      $(wrapper)
        .find(".settings-btn")
        .on("click", () => me.open_block_settings_dialog(wrapper, "QR Code"));
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    } else if (type === "timestamp_block" || type === "current_user_block") {
      wrapper.className = "canvas-section py-2";
      wrapper.dataset.type = type;
      wrapper.dataset.alignment = alignment;
      wrapper.dataset.style = JSON.stringify({});
      wrapper.dataset.label =
        type === "timestamp_block" ? "Timestamp" : "Current User";
      wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong class="block-label-text">${wrapper.dataset.label}</strong>
          <div style="display:flex; gap:4px; align-items:center;">
            <button class="action-icon-btn settings-btn" title="Settings">⚙</button>
            <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
          </div>
        </div>
      `;
      $(wrapper)
        .find(".settings-btn")
        .on("click", () =>
          me.open_block_settings_dialog(
            wrapper,
            type === "timestamp_block" ? "Timestamp" : "Current User",
          ),
        );
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    } else if (type === "spacer") {
      wrapper.className = "canvas-section py-1 text-center text-muted small";
      wrapper.dataset.type = "spacer";
      wrapper.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>--- Spacer ---</span>
          <button class="action-icon-btn remove-btn" title="Delete">&times;</button>
        </div>
      `;
      $(wrapper)
        .find(".remove-btn")
        .on("click", () => {
          wrapper.remove();
          me.mark_unsaved();
        });
    }
    return wrapper;
  }

  save_layout() {
    let doctype = this.selectedDocType;
    let formatName = this.format_name_field.get_value();
    let letterHead = this.letter_head_field.get_value();

    if (!doctype) {
      frappe.msgprint(__("Please select a DocType."));
      return;
    }
    if (!formatName) {
      frappe.msgprint(__("Please provide a Format Name."));
      return;
    }

    let settings = {
      label_width: $("#setting-label-width").val() || "40",
      margin_top: $("#setting-margin-top").val() || "",
      margin_bottom: $("#setting-margin-bottom").val() || "",
      margin_left: $("#setting-margin-left").val() || "",
      margin_right: $("#setting-margin-right").val() || "",
      page_number: $("#setting-page-number").val() || "",
      disabled: $("#setting-is-disabled").is(":checked") ? 1 : 0,
    };

    let layout = [];

    document
      .querySelectorAll(
        "#canvas > .canvas-section, #canvas > .canvas-field-item",
      )
      .forEach((el) => {
        let type = el.dataset.type;
        let alignment = el.dataset.alignment || "Left";
        let style = JSON.parse(el.dataset.style || "{}");

        if (type === "section") {
          let title = el.querySelector(".section-title-input").value;
          let colDropzones = el.querySelectorAll(".column-dropzone");
          let columns = Array.from({ length: colDropzones.length }, () => []);

          colDropzones.forEach((colEl, colIdx) => {
            colEl.querySelectorAll(".canvas-field-item").forEach((fieldEl) => {
              columns[colIdx].push({
                type: fieldEl.dataset.type,
                fieldtype: fieldEl.dataset.fieldtype || "Data",
                fieldname: fieldEl.dataset.fieldname,
                label: fieldEl.dataset.label,
                alignment: fieldEl.dataset.alignment || "Left",
                style: JSON.parse(fieldEl.dataset.style || "{}"),
                columns: fieldEl.dataset.columns
                  ? JSON.parse(fieldEl.dataset.columns)
                  : [],
              });
            });
          });

          layout.push({
            type: "section",
            label: title,
            alignment: alignment,
            style: style,
            columns: columns,
          });
        } else if (type === "heading") {
          layout.push({
            type: "heading",
            text: el.querySelector("input").value,
            alignment: alignment,
            style: style,
          });
        } else if (type === "html_block") {
          layout.push({
            type: "html_block",
            html: el.querySelector("textarea").value,
            alignment: alignment,
            style: style,
          });
        } else if (type === "qrcode_block") {
          layout.push({
            type: "qrcode_block",
            config: JSON.parse(el.dataset.config || "{}"),
            alignment: alignment,
            style: style,
          });
        } else if (
          type === "timestamp_block" ||
          type === "current_user_block"
        ) {
          layout.push({
            type: type,
            label: el.dataset.label,
            alignment: alignment,
            style: style,
          });
        } else if (type === "spacer") {
          layout.push({ type: "spacer" });
        } else if (type === "field" || type === "table") {
          layout.push({
            type: type,
            fieldtype: el.dataset.fieldtype || "Data",
            fieldname: el.dataset.fieldname,
            label: el.dataset.label,
            alignment: alignment,
            style: style,
            columns: el.dataset.columns ? JSON.parse(el.dataset.columns) : [],
          });
        }
      });

    if (layout.length === 0) {
      frappe.msgprint(__("Canvas is empty! Drag some items first."));
      return;
    }

    let me = this;
    frappe.call({
      method: "participatory_backend.api.save_custom_print_format",
      args: {
        doctype_name: doctype,
        format_name: formatName,
        letter_head: letterHead || "",
        settings_json: JSON.stringify(settings),
        layout_json: JSON.stringify(layout),
      },
      callback: (r) => {
        if (!r.exc) {
          me.mark_saved();
          frappe.show_alert({
            message: __("Print Format Saved Successfully!"),
            indicator: "green",
          });
        }
      },
    });
  }
}

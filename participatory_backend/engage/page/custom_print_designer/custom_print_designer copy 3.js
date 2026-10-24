frappe.pages["custom-print-designer"].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Print Layout Designer"),
    single_column: true,
  });

  // Dynamically load SortableJS library
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

    this.render_layout();
    this.setup_toolbar();
  }

  setup_toolbar() {
    let me = this;

    // Create a field container in the page header for DocType, Format Name, and Letter Head
    const $field_area = $(`
      <div
        class="row mb-3"
        style="display:flex; width:100%; gap:15px; align-items:center; padding:10px"
      >
        <div style="flex:1; min-width:0;" class="item-one"></div>
        <div style="flex:1; min-width:0;" class="item-two"></div>
        <div style="flex:1; min-width:0;" class="item-three"></div>
      </div>
    `);

    $(this.page.body).prepend($field_area);

    // DocType Selector Dropdown
    frappe.ui.form.make_control({
      parent: $field_area.find(".item-one"),
      df: {
        fieldname: "doctype_select",
        label: __("Select DocType"),
        fieldtype: "Link",
        options: "DocType",
        reqd: 1,
        get_query: function () {
          return { filters: { custom: 1 } }; // Filter for custom doctypes
        },
        change() {
          me.selectedDocType = this.get_value();
          me.load_doctype_fields();
        },
      },
      render_input: true,
    });

    // Format Name Input
    this.format_name_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-two"),
      df: {
        fieldname: "format_name",
        label: __("Format Name"),
        fieldtype: "Data",
        placeholder: "My Custom Print Layout",
        reqd: 1,
      },
      render_input: true,
    });

    // Letter Head Selector Control
    this.letter_head_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-three"),
      df: {
        fieldname: "letter_head",
        label: __("Letter Head"),
        fieldtype: "Link",
        options: "Letter Head",
        placeholder: "Select Letter Head",
      },
      render_input: true,
    });

    // Save Button
    this.page.set_primary_action(__("Save Print Format"), () =>
      this.save_layout(),
    );
  }

  render_layout() {
    // Render HTML structure for palette sidebar and paper canvas
    this.page.main.html(`
            <style>
                .designer-wrapper { display: flex; flex-direction: column; height: calc(100vh - 140px); gap: 15px; padding: 10px; }
                .top-toolbar { background: #fff; border: 1px solid #d1d8dd; border-radius: 8px; padding: 15px; display: flex; gap: 20px; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .toolbar-group { display: flex; gap: 15px; align-items: center; flex: 1; }
                .designer-container { display: flex; gap: 20px; flex: 1; overflow: hidden; }
                .palette { width: 300px; background: #f8f9fa; border: 1px solid #d1d8dd; border-radius: 8px; padding: 15px; overflow-y: auto; }
                .canvas-wrapper { flex: 1; background: #eaeded; border: 1px solid #d1d8dd; border-radius: 8px; padding: 20px; overflow-y: auto; display: flex; justify-content: center; }
                .paper-canvas { width: 100%; max-width: 750px; min-height: 700px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 4px; padding: 30px; }
                .drag-item { background: #fff; border: 1px solid #d1d8dd; border-radius: 4px; padding: 10px 12px; margin-bottom: 8px; cursor: grab; font-weight: 500; }
                .canvas-section { border: 2px dashed #cbd5e0; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: #f7fafc; position: relative; }
                .canvas-section .remove-btn { position: absolute; right: 10px; top: 10px; color: #e53e3e; cursor: pointer; font-size: 18px; }
                .section-columns { display: flex; gap: 15px; margin-top: 10px; }
                .column-dropzone { flex: 1; min-height: 80px; background: #fff; border: 1px dashed #a0aec0; border-radius: 4px; padding: 10px; }
                .canvas-field-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-bottom: 6px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
                .ghost-class { opacity: 0.4; background: #edf2f7; }
            </style>

            <div class="designer-wrapper">
                <div class="designer-container">
                    <!-- Sidebar Palette containing structure items and DocType fields -->
                    <div class="palette">
                        <h6 class="text-muted uppercase font-weight-bold mb-3">${__("Structure Elements")}</h6>
                        <div id="static-elements">
                            <div class="drag-item" data-type="section" style="background: #ebf8ff; border-color: #bee3f8;">${__("📁 2-Column Section")}</div>
                            <div class="drag-item" data-type="heading">${__("📌 Title / Heading")}</div>
                            <div class="drag-item" data-type="html_block" style="background: #fef3c7; border-color: #fde68a;">${__("⚡ Custom HTML Block")}</div>
                            <div class="drag-item" data-type="spacer">${__("📏 Spacer Block")}</div>
                        </div>

                        <h6 class="text-muted uppercase font-weight-bold my-3">${__("DocType Fields")}</h6>
                        <div id="field-elements">
                            <p class="text-muted small">${__("Select a DocType above to load fields")}</p>
                        </div>
                    </div>

                    <!-- Main Dropzone Canvas -->
                    <div class="canvas-wrapper">
                        <div class="paper-canvas" id="canvas">
                            <p class="text-muted text-center mt-5" id="canvas-placeholder">${__("Drag sections, fields, or HTML elements here")}</p>
                        </div>
                    </div>
                </div>
            </div>
        `);

    this.init_drag_drop();
  }

  load_doctype_fields() {
    if (!this.selectedDocType) return;

    // Load meta information for the selected custom DocType
    frappe.model.with_doctype(this.selectedDocType, () => {
      let meta = frappe.get_meta(this.selectedDocType);
      let fieldsContainer = $(this.page.main).find("#field-elements");
      fieldsContainer.empty();

      meta.fields.forEach((f) => {
        if (!["Section Break", "Column Break"].includes(f.fieldtype)) {
          fieldsContainer.append(`
                        <div class="drag-item" data-type="${f.fieldtype === "Table" ? "table" : "field"}" data-fieldname="${f.fieldname}" data-label="${f.label}">
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

    // Allow dragging from static sidebar palette
    new Sortable(document.getElementById("static-elements"), {
      group: { name: "shared", pull: "clone", put: false },
      sort: false,
    });

    // Allow dragging from dynamic field sidebar palette
    new Sortable(document.getElementById("field-elements"), {
      group: { name: "shared", pull: "clone", put: false },
      sort: false,
    });

    // Dropzone Root Canvas Setup (Now accepts fields, tables, headings, custom HTML, and sections directly)
    new Sortable(canvasEl, {
      group: "shared",
      animation: 150,
      ghostClass: "ghost-class",
      onAdd: function (evt) {
        $("#canvas-placeholder").hide();
        let itemEl = evt.item;

        let type = itemEl.dataset.type;
        let fieldname = itemEl.dataset.fieldname || "";
        let label = itemEl.dataset.label || itemEl.innerText.trim();

        // Check if dropped element is a raw field/table vs structural section block
        let newCanvasItem;
        if (type === "field" || type === "table") {
          newCanvasItem = me.create_canvas_field_item(
            type,
            label,
            fieldname,
            itemEl,
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
      },
    });
  }

  init_nested_sortables() {
    let me = this;
    // Initialize sortable on all column dropzones inside sections
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
              // Prevent nesting sections inside columns
              evt.item.remove();
              frappe.show_alert({
                message: __("Cannot drop a section inside a column column."),
                indicator: "orange",
              });
              return;
            }

            let fieldname = itemEl.dataset.fieldname || "";
            let label = itemEl.dataset.label || itemEl.innerText.trim();

            let newItem = me.create_canvas_field_item(
              type,
              label,
              fieldname,
              itemEl,
            );
            itemEl.replaceWith(newItem);
          },
        });
      }
    });
  }

  create_canvas_field_item(type, label, fieldname, sourceEl) {
    let newItem = document.createElement("div");
    newItem.className = "canvas-field-item";
    newItem.dataset.type = type;
    newItem.dataset.fieldname = fieldname;
    newItem.dataset.label = label;

    let extraHtml = "";
    if (type === "table") {
      // Store default columns data on element dataset for table column customization
      newItem.dataset.columns = JSON.stringify([]);
      extraHtml = ` <button class="btn btn-xs btn-default ml-2 configure-table-btn">Configure Columns</button>`;
    }

    newItem.innerHTML = `<span><strong>${label}</strong> ${type === "table" ? "(Table)" : ""}</span> ${extraHtml} <span class="text-danger ml-2" style="cursor:pointer;" onclick="this.parentElement.remove()">&times;</span>`;

    // Bind table column configuration dialog trigger
    if (type === "table") {
      $(newItem)
        .find(".configure-table-btn")
        .on("click", () => {
          this.open_table_column_config(newItem, fieldname);
        });
    }

    return newItem;
  }

  // Helper dialog allowing users to add, reorder, and remove table columns for printing
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

  create_canvas_element(type, label, fieldname, sourceEl) {
    let wrapper = document.createElement("div");

    if (type === "section") {
      wrapper.className = "canvas-section";
      wrapper.dataset.type = "section";
      wrapper.innerHTML = `
                <span class="remove-btn" onclick="this.parentElement.remove()">&times;</span>
                <input type="text" class="form-control form-control-sm font-weight-bold mb-2 section-title-input" value="Section Title" style="width: 50%;">
                <div class="section-columns">
                    <div class="column-dropzone" data-col="0"><small class="text-muted">Left Column</small></div>
                    <div class="column-dropzone" data-col="1"><small class="text-muted">Right Column</small></div>
                </div>
            `;
    } else if (type === "heading") {
      wrapper.className = "canvas-section py-2";
      wrapper.dataset.type = "heading";
      wrapper.innerHTML = `
                <span class="remove-btn" onclick="this.parentElement.remove()">&times;</span>
                <input type="text" class="form-control form-control-sm font-weight-bold" value="${sourceEl.innerText.trim()}">
            `;
    } else if (type === "html_block") {
      wrapper.className = "canvas-section py-2";
      wrapper.dataset.type = "html_block";
      wrapper.innerHTML = `
                <span class="remove-btn" onclick="this.parentElement.remove()">&times;</span>
                <label class="text-muted small font-weight-bold">Custom HTML / Jinja</label>
                <textarea class="form-control form-control-sm html-content-input" rows="3" placeholder="Enter custom HTML or Jinja tags here..."></textarea>
            `;
    } else if (type === "spacer") {
      wrapper.className = "canvas-section py-1 text-center text-muted small";
      wrapper.dataset.type = "spacer";
      wrapper.innerHTML = `<span class="remove-btn" onclick="this.parentElement.remove()">&times;</span>--- Spacer ---`;
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

    let layout = [];

    // Collect all elements recursively from root canvas children
    document
      .querySelectorAll(
        "#canvas > .canvas-section, #canvas > .canvas-field-item",
      )
      .forEach((el) => {
        let type = el.dataset.type;
        if (type === "section") {
          let title = el.querySelector(".section-title-input").value;
          let columns = [[], []];

          el.querySelectorAll(".column-dropzone").forEach((colEl, colIdx) => {
            colEl.querySelectorAll(".canvas-field-item").forEach((fieldEl) => {
              columns[colIdx].push({
                type: fieldEl.dataset.type,
                fieldname: fieldEl.dataset.fieldname,
                label: fieldEl.dataset.label,
                columns: fieldEl.dataset.columns
                  ? JSON.parse(fieldEl.dataset.columns)
                  : [],
              });
            });
          });

          layout.push({ type: "section", label: title, columns: columns });
        } else if (type === "heading") {
          layout.push({
            type: "heading",
            text: el.querySelector("input").value,
          });
        } else if (type === "html_block") {
          layout.push({
            type: "html_block",
            html: el.querySelector("textarea").value,
          });
        } else if (type === "spacer") {
          layout.push({ type: "spacer" });
        } else if (type === "field" || type === "table") {
          layout.push({
            type: type,
            fieldname: el.dataset.fieldname,
            label: el.dataset.label,
            columns: el.dataset.columns ? JSON.parse(el.dataset.columns) : [],
          });
        }
      });

    if (layout.length === 0) {
      frappe.msgprint(__("Canvas is empty! Drag some items first."));
      return;
    }

    // Send to Whitelisted Python Backend including letter_head
    frappe.call({
      method: "participatory_backend.api.save_custom_print_format",
      args: {
        doctype_name: doctype,
        format_name: formatName,
        letter_head: letterHead || "",
        layout_json: JSON.stringify(layout),
      },
      callback: (r) => {
        if (!r.exc) {
          frappe.show_alert({
            message: __("Print Format Saved Successfully!"),
            indicator: "green",
          });
        }
      },
    });
  }
}

// Ensure helper instance reference is available in scope for callbacks
let me = null;

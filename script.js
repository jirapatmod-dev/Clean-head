/* ==========================================================
   script.js — ใช้ร่วมกันทุกหน้า
   ตรวจจากรหัส element ที่มีในหน้า แล้วทำงานเฉพาะส่วนที่เกี่ยวข้อง
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

(function () {
  "use strict";

  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyI6xf45jCZYIaGDqfMwyEF-hvivDWSIqyoGCt17NIM1U4iSjXw2qsZwUz4s9cF4erC/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1byBQ0gUBOf1Om7o2ai-V58BUatIdwaB9t6H-klY7y67G1xciCI-71fOxW4AdByV5EQ_tC7Yc4WHU/pub?gid=0&single=true&output=csv";

  /* ---------- helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(n) {
    var num = Number(n);
    if (isNaN(num)) return String(n);
    return num.toLocaleString("th-TH") + " บาท";
  }

  /* ==========================================================
     1) product.html — แสดงสินค้า + ตัวกรอง mood
     ========================================================== */

  var MOODS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "fresh", label: "Fresh" },
    { value: "confident", label: "Confident" }
  ];

  function initProducts() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var current = "all";

    // อ่าน ?mood=xxx (ใช้ได้เฉพาะค่าที่มีในตัวกรอง)
    var moodParam = new URLSearchParams(window.location.search).get("mood");
    if (moodParam) {
      moodParam = moodParam.toLowerCase();
      var valid = MOODS.some(function (m) { return m.value === moodParam; });
      if (valid) current = moodParam;
    }

    function buildFilterBar() {
      filterBar.innerHTML = "";
      MOODS.forEach(function (m) {
        var btn = el("button", "btn", m.label);
        btn.type = "button";
        btn.dataset.mood = m.value;
        btn.setAttribute("aria-pressed", String(m.value === current));
        if (m.value === current) btn.classList.add("btn--accent");
        btn.addEventListener("click", function () {
          current = m.value;
          // อัปเดต URL โดยไม่โหลดหน้าใหม่
          var url = new URL(window.location.href);
          if (current === "all") url.searchParams.delete("mood");
          else url.searchParams.set("mood", current);
          history.replaceState(null, "", url);
          buildFilterBar();
          render();
        });
        filterBar.appendChild(btn);
      });
    }

    function buildCard(p) {
      var card = el("article", "card");
      card.dataset.mood = p.mood;

      var imgWrap = el("div", "card__image");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      imgWrap.appendChild(img);

      var title = el("h3", "card__title", p.name);
      var meta = el("p", "card__meta", p.size);
      var price = el("div", "price", formatPrice(p.price));

      // item = ชื่อสินค้า + ไซส์ (เช่น "ยาสระผม Fresh เล็ก 30ml")
      var itemText = p.name + " " + p.size;
      var order = el("a", "btn btn--accent", "สั่งซื้อ");
      order.href =
        "order.html?item=" + encodeURIComponent(itemText) +
        "&price=" + encodeURIComponent(p.price);

      card.appendChild(imgWrap);
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(price);
      card.appendChild(order);
      return card;
    }

    function render() {
      list.innerHTML = "";
      var shown = products.filter(function (p) {
        return current === "all" || p.mood === current;
      });
      if (!shown.length) {
        list.appendChild(el("p", "notice", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) { list.appendChild(buildCard(p)); });
    }

    buildFilterBar();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (err) {
        console.error(err);
        list.innerHTML = "";
        list.appendChild(el("p", "notice", "โหลดรายการสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
      });
  }

  /* ==========================================================
     2) order.html — เติมฟอร์มจาก URL + ส่งคำสั่งซื้อ
     ========================================================== */

  function initOrder() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsField = document.getElementById("items");
    var totalField = document.getElementById("total");

    // เติมค่า item และ price จาก URL ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (itemsField && item !== null) itemsField.value = item;
    if (totalField && price !== null) totalField.value = price;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var totalRaw = totalField.value.trim();
      var totalNum = Number(totalRaw);

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: itemsField.value.trim(),
        total: totalRaw !== "" && !isNaN(totalNum) ? totalNum : totalRaw,
        note: document.getElementById("note").value.trim()
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () { window.location.href = "thankyou.html"; })
        .catch(function (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) admin.html — ดึง CSV จาก Google Sheet แสดงเป็นตาราง
     ========================================================== */

  // parse CSV เอง: รองรับ "..." ครอบค่า, "" แทนเครื่องหมายคำพูด,
  // ขึ้นบรรทัดใหม่ในช่อง และจบบรรทัดแบบ \r\n หรือ \n
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function initAdmin() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLS = 6;

    function showMessage(msg) {
      tbody.innerHTML = "";
      var tr = document.createElement("tr");
      var td = el("td", null, msg);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ""; });
        });

        // ถ้าแถวแรกเป็นหัวตาราง (ช่องจำนวนเงินไม่ใช่ตัวเลข) ให้ข้ามไป
        if (rows.length) {
          var totalCell = (rows[0][4] || "").replace(/,/g, "").trim();
          if (totalCell !== "" && isNaN(Number(totalCell))) rows.shift();
        }

        if (!rows.length) {
          showMessage("ยังไม่มีคำสั่งซื้อ");
          return;
        }

        // Sheet ถูกเพิ่มแถวต่อท้ายตามลำดับเวลา จึงกลับด้านให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.innerHTML = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < COLS; i++) {
            tr.appendChild(el("td", null, r[i] !== undefined ? r[i] : ""));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- start ---------- */

  function init() {
    initProducts();
    initOrder();
    initAdmin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

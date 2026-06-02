let rates = {};
const inputs = ["GHS", "USD", "EUR", "GBP", "CNY", "NGN"];
let isUpdating = false;

async function loadRates() {
  try {
    const res = await fetch("./rates.json");
    if (!res.ok) throw new Error("Failed to load rates.json");

    const data = await res.json();
    rates = data.rates || {};

    const lastUpdated = document.getElementById("lastUpdated");
    if (lastUpdated) {
      const updatedAt = data.updated_at
        ? new Date(data.updated_at).toLocaleString()
        : "Unknown time";
      const sourceDate = data.source_page_date || "Unknown date";
      lastUpdated.textContent = `BoG Date: ${sourceDate} | Updated: ${updatedAt}`;
    }

    attachInputHandlers();
    seedDefaultValue();
  } catch (error) {
    const lastUpdated = document.getElementById("lastUpdated");
    if (lastUpdated) {
      lastUpdated.textContent = "Unable to load exchange rates";
    }
    console.error(error);
  }
}

function attachInputHandlers() {
  inputs.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener("input", (event) => {
      if (isUpdating) return;

      const cleaned = cleanNumber(event.target.value);
      if (cleaned === "" || cleaned === ".") {
        clearOtherInputs(id);
        return;
      }

      const value = parseFloat(cleaned);
      if (Number.isNaN(value)) return;

      input.dataset.raw = value.toString();
      convertFrom(id, value, id);
    });

    input.addEventListener("focus", () => {
      const raw = input.dataset.raw || cleanNumber(input.value);
      if (raw) input.value = raw;
      input.select();
    });

    input.addEventListener("blur", () => {
      const raw = input.dataset.raw;
      if (raw && !Number.isNaN(parseFloat(raw))) {
        input.value = formatNumber(parseFloat(raw));
      }
    });
  });
}

function cleanNumber(value) {
  return value.replace(/,/g, "").replace(/[^\d.]/g, "");
}

function toGHS(currency, value) {
  if (currency === "GHS") return value;
  return value * rates[currency];
}

function fromGHS(currency, ghsValue) {
  if (currency === "GHS") return ghsValue;
  return ghsValue / rates[currency];
}

function formatNumber(value) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function convertFrom(base, value, activeField = null) {
  if (base !== "GHS" && !rates[base]) return;

  isUpdating = true;
  const ghsValue = toGHS(base, value);

  inputs.forEach((currency) => {
    const field = document.getElementById(currency);
    if (!field) return;

    const converted = fromGHS(currency, ghsValue);
    if (!Number.isFinite(converted)) {
      field.dataset.raw = "";
      field.value = "";
      return;
    }

    field.dataset.raw = converted.toString();

    if (currency === activeField && document.activeElement === field) {
      field.value = field.dataset.raw;
    } else {
      field.value = formatNumber(converted);
    }
  });

  isUpdating = false;
}

function clearOtherInputs(activeId) {
  inputs.forEach((currency) => {
    const field = document.getElementById(currency);
    if (!field) return;

    if (currency === activeId) {
      field.dataset.raw = "";
      return;
    }

    field.value = "";
    field.dataset.raw = "";
  });
}

function seedDefaultValue() {
  const ghsInput = document.getElementById("GHS");
  if (!ghsInput) return;

  ghsInput.dataset.raw = "1";
  convertFrom("GHS", 1);
}

document.addEventListener("DOMContentLoaded", loadRates);
let rates = {};
const inputs = ["GHS", "USD", "EUR", "GBP", "CNY", "NGN"];
let isUpdating = false;

async function loadRates() {
  try {
    const res = await fetch("./rates.json");
    if (!res.ok) {
      throw new Error("Failed to load rates.json");
    }

    const data = await res.json();
    rates = data.rates || {};

    const lastUpdated = document.getElementById("lastUpdated");
    if (lastUpdated) {
      const updatedAt = data.updated_at
        ? new Date(data.updated_at).toLocaleString()
        : "Unknown time";

      const sourceDate = data.source_page_date || "Unknown date";

      lastUpdated.textContent =
        `BoG Date: ${sourceDate} | Updated: ${updatedAt}`;
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

      const value = parseFloat(event.target.value);

      if (Number.isNaN(value)) {
        clearOtherInputs(id);
        return;
      }

      convertFrom(id, value);
    });

    input.addEventListener("focus", () => {
      input.select();
    });
  });
}

function convertFrom(base, value) {
  if (!rates[base]) return;

  isUpdating = true;
  const inGHS = value / rates[base];

  inputs.forEach((currency) => {
    const field = document.getElementById(currency);
    if (!field) return;

    if (currency === base) {
      field.value = value;
      return;
    }

    const converted = inGHS * rates[currency];
    field.value = Number.isFinite(converted) ? converted.toFixed(4) : "";
  });

  isUpdating = false;
}

function clearOtherInputs(activeId) {
  inputs.forEach((currency) => {
    if (currency === activeId) return;
    const field = document.getElementById(currency);
    if (field) {
      field.value = "";
    }
  });
}

function seedDefaultValue() {
  const ghsInput = document.getElementById("GHS");
  if (!ghsInput) return;

  ghsInput.value = "1";
  convertFrom("GHS", 1);
}

document.addEventListener("DOMContentLoaded", loadRates);
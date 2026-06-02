let rates = {};
const inputs = ["GHS", "USD", "EUR", "GBP", "CNY", "NGN"];
let isUpdating = false;

async function loadRates() {
  try {
    const res = await fetch('./rates.json');
    if (!res.ok) throw new Error('Failed to load rates.json');

    const data = await res.json();
    rates = data.rates || {};

    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) {
      const updatedAt = data.updated_at
        ? new Date(data.updated_at).toLocaleString()
        : 'Unknown time';
      const sourceDate = data.source_page_date || 'Unknown date';
      lastUpdated.textContent = `BoG Date: ${sourceDate} | Updated: ${updatedAt}`;
    }

    attachInputHandlers();
    seedDefaultValue();
  } catch (error) {
    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) lastUpdated.textContent = 'Unable to load exchange rates';
    console.error(error);
  }
}

function attachInputHandlers() {
  inputs.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', (event) => {
      if (isUpdating) return;

      const rawValue = event.target.value.replace(/,/g, '');
      const value = parseFloat(rawValue);

      if (Number.isNaN(value)) {
        clearOtherInputs(id);
        return;
      }

      convertFrom(id, value);
    });

    input.addEventListener('focus', () => {
      const rawValue = input.value.replace(/,/g, '');
      input.value = rawValue;
      input.select();
    });

    input.addEventListener('blur', () => {
      const value = parseFloat(input.value.replace(/,/g, ''));
      if (!Number.isNaN(value)) {
        input.value = formatNumber(value);
      }
    });
  });
}

function toGHS(currency, value) {
  if (currency === 'GHS') return value;
  return value * rates[currency];
}

function fromGHS(currency, ghsValue) {
  if (currency === 'GHS') return ghsValue;
  return ghsValue / rates[currency];
}

function formatNumber(value) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function convertFrom(base, value) {
  if (base !== 'GHS' && !rates[base]) return;

  isUpdating = true;
  const ghsValue = toGHS(base, value);

  inputs.forEach((currency) => {
    const field = document.getElementById(currency);
    if (!field) return;

    const converted = fromGHS(currency, ghsValue);
    field.value = Number.isFinite(converted) ? formatNumber(converted) : '';
  });

  isUpdating = false;
}

function clearOtherInputs(activeId) {
  inputs.forEach((currency) => {
    if (currency === activeId) return;
    const field = document.getElementById(currency);
    if (field) field.value = '';
  });
}

function seedDefaultValue() {
  const ghsInput = document.getElementById('GHS');
  if (!ghsInput) return;
  convertFrom('GHS', 1);
}

document.addEventListener('DOMContentLoaded', loadRates);
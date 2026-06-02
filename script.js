let rates = {};

async function loadRates() {
  const res = await fetch('rates.json');
  const data = await res.json();
  rates = data.rates;

  document.getElementById("lastUpdated").innerText =
    "Last Updated: " + data.date;
}

const inputs = ["GHS", "USD", "EUR", "GBP", "CNY", "NGN"];

inputs.forEach(id => {
  document.getElementById(id).addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    if (isNaN(value)) return;

    const base = id;

    // Convert everything via GHS
    let inGHS = value / rates[base];

    inputs.forEach(cur => {
      if (cur !== base) {
        const converted = inGHS * rates[cur];
        document.getElementById(cur).value =
          converted.toFixed(2);
      }
    });
  });
});

loadRates();

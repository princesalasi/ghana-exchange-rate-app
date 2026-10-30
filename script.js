const DEFAULT_LIST = ["GHS", "USD", "EUR", "GBP", "CNY", "NGN"];
const STORAGE_KEY = "fx.currencies.v1";
const STALE_AFTER_DAYS = 4;

const SYMBOLS = { GHS: "₵", XOF: "CFA", XAF: "FCFA" };

const KEYS = [
  ["C", "C", "Clear"], ["back", "⌫", "Delete"], ["%", "%", "Percent"], ["÷", "÷", "Divide"],
  ["7", "7"], ["8", "8"], ["9", "9"], ["×", "×", "Multiply"],
  ["4", "4"], ["5", "5"], ["6", "6"], ["-", "−", "Subtract"],
  ["1", "1"], ["2", "2"], ["3", "3"], ["+", "+", "Add"],
  ["00", "00"], ["0", "0"], [".", ".", "Decimal point"], ["=", "=", "Equals"]
];

const names = new Intl.DisplayNames(["en"], { type: "currency" });

const state = {
  data: null,
  mode: "selling",
  list: DEFAULT_LIST,
  active: "GHS",
  expression: "100",
  replace: true
};


function element(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}


function loadList(rates) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (Array.isArray(saved)) {
      const valid = saved.filter((code) => code !== "GHS" && rates[code]);

      if (valid.length) {
        return ["GHS", ...valid];
      }
    }
  } catch (error) {
    // Blocked or corrupt storage falls through to the defaults.
  }

  return DEFAULT_LIST.filter((code) => code === "GHS" || rates[code]);
}


function saveList() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.list));
  } catch (error) {
    // The list still works for this visit without storage.
  }
}


function rateOf(code) {
  return code === "GHS" ? 1 : state.data.rates[code][state.mode];
}


function isOfficial(code) {
  return state.data.rates[code]?.source === "bog";
}


function formatAmount(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const digits = Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2;

  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}


function symbolOf(code) {
  if (SYMBOLS[code]) {
    return SYMBOLS[code];
  }

  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol"
    }).formatToParts(0);

    return parts.find((part) => part.type === "currency").value;
  } catch (error) {
    return code;
  }
}


function nameOf(code) {
  try {
    return names.of(code);
  } catch (error) {
    return code;
  }
}


function unitLabel(code) {
  const rate = rateOf(code);

  return rate < 0.1
    ? `100 ${code} = ₵${formatAmount(rate * 100)}`
    : `1 ${code} = ₵${formatAmount(rate)}`;
}


function coin(code) {
  const symbol = symbolOf(code);

  return element("span", symbol.length > 2 ? "coin coin-small" : "coin", symbol);
}


function renderRows() {
  const rows = document.getElementById("rows");
  const focused = document.activeElement?.dataset?.code;
  const value = evalExpression(state.expression);
  const ghs = value * rateOf(state.active);
  const hasOperator = /[+\-×÷%]/.test(state.expression);

  rows.replaceChildren(...state.list.map((code) => {
    const active = code === state.active;
    const row = element("button", active ? "row row-active" : "row");
    row.type = "button";
    row.dataset.code = code;
    row.setAttribute("aria-pressed", String(active));
    row.addEventListener("click", () => pickRow(code));

    const label = element("span", "row-label");
    label.append(
      element("span", "row-code", code),
      element("span", "row-sub", code === "GHS" ? "Cedi" : isOfficial(code) ? "Bank of Ghana" : "Market")
    );

    const amount = element("span", "row-amount");
    amount.append(
      element("span", "row-value", formatAmount(active ? value : ghs / rateOf(code))),
      element("span", "row-sub", active && hasOperator
        ? state.expression
        : code === "GHS" ? "Ghana cedi" : unitLabel(code))
    );

    row.append(coin(code), label, amount);
    return row;
  }));

  if (focused) {
    rows.querySelector(`[data-code="${focused}"]`)?.focus();
  }
}


function pickRow(code) {
  if (code === state.active) {
    return;
  }

  const ghs = evalExpression(state.expression) * rateOf(state.active);
  const value = ghs / rateOf(code);

  state.active = code;
  // Keep full precision so tapping between rows does not shift the amounts.
  state.expression = Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : "";
  state.replace = true;
  renderRows();
}


function press(key) {
  const result = pressKey(state.expression, state.replace, key);

  state.expression = result.expression;
  state.replace = result.replace;
  renderRows();
}


function setMode(mode) {
  state.mode = mode;

  const selling = mode === "selling";
  const buyingButton = document.getElementById("buyingButton");
  const sellingButton = document.getElementById("sellingButton");

  buyingButton.setAttribute("aria-pressed", String(!selling));
  sellingButton.setAttribute("aria-pressed", String(selling));
  renderRows();
}


function renderKeypad() {
  const keypad = document.getElementById("keypad");

  keypad.replaceChildren(...KEYS.map(([key, label, description]) => {
    const kind = key === "=" ? "key key-equals"
      : "÷×-+".includes(key) ? "key key-operator"
      : ["C", "back", "%"].includes(key) ? "key key-function"
      : "key";
    const button = element("button", kind, label);

    button.type = "button";
    button.setAttribute("aria-label", description || label);
    button.addEventListener("click", () => press(key));
    return button;
  }));
}


function handleKeyboard(event) {
  if (
    event.ctrlKey || event.metaKey || event.altKey ||
    !document.getElementById("pickerScreen").hidden
  ) {
    return;
  }

  const onButton = event.target.tagName === "BUTTON";
  const map = { "*": "×", "/": "÷", Backspace: "back", Delete: "C", Escape: "C" };
  let key = map[event.key] || event.key;

  if (key === "Enter") {
    if (onButton) {
      return;
    }
    key = "=";
  }

  if (/^\d$/.test(key) || ["+", "-", "×", "÷", "%", ".", "=", "back", "C"].includes(key)) {
    event.preventDefault();
    press(key);
  }
}


function daysOld(isoDate) {
  return isoDate ? Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000) : Infinity;
}


function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  });
}


function renderStatus() {
  const status = document.getElementById("status");
  const { bog_date: bogDate, market_date: marketDate } = state.data;
  const age = daysOld(bogDate);

  if (age > STALE_AFTER_DAYS) {
    status.className = "status status-stale";
    status.textContent = bogDate
      ? `Bank of Ghana rates are ${age} days old. Check before you trade.`
      : "Bank of Ghana rates are unavailable. Showing market rates only.";
    return;
  }

  status.className = "status";
  status.textContent = marketDate
    ? `Bank of Ghana ${formatDate(bogDate)} · Market ${formatDate(marketDate)}`
    : `Bank of Ghana ${formatDate(bogDate)}`;
}


function renderTable() {
  const body = document.getElementById("tableBody");
  const official = Object.keys(state.data.rates).filter(isOfficial);

  body.replaceChildren(...official.map((code) => {
    const row = element("tr");
    const heading = element("th", "", code);
    heading.scope = "row";
    const { buying, selling } = state.data.rates[code];
    const digits = selling < 0.1 ? 6 : 4;
    row.append(
      heading,
      element("td", "", buying.toFixed(digits)),
      element("td", "", selling.toFixed(digits))
    );
    return row;
  }));
}


function renderCredits() {
  const credits = document.getElementById("credits");
  const link = (text, href) => {
    const anchor = element("a", "", text);
    anchor.href = href;
    anchor.rel = "noopener";
    return anchor;
  };
  const sources = [link("Bank of Ghana", "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/")];

  sources.push(state.data.market_source === "er-api"
    ? link("Rates By Exchange Rate API", "https://www.exchangerate-api.com")
    : link("Frankfurter", "https://frankfurter.dev"));

  credits.replaceChildren("Rates: ", sources[0], " and ", sources[1], ". Market rates are one mid rate.");
}


function choiceButton(code) {
  const added = state.list.includes(code);
  const button = element("button", added ? "choice choice-added" : "choice");
  button.type = "button";
  button.dataset.code = code;
  button.setAttribute("aria-pressed", String(added));
  button.addEventListener("click", () => toggleCurrency(code));

  const text = element("span", "choice-text");
  text.append(element("span", "row-code", code), element("span", "row-sub", nameOf(code)));

  button.append(coin(code), text, element("span", "choice-mark", added ? "Added" : "Add"));
  return button;
}


function renderChoices() {
  const choices = document.getElementById("choices");
  const focused = document.activeElement?.dataset?.code;
  const query = document.getElementById("search").value.trim().toLowerCase();
  const matches = Object.keys(state.data.rates).filter((code) =>
    !query || code.toLowerCase().includes(query) || nameOf(code).toLowerCase().includes(query)
  );
  const inList = (code) => state.list.includes(code);
  const groups = [
    ["Your list", matches.filter(inList)],
    ["Bank of Ghana: buying and selling", matches.filter((code) => !inList(code) && isOfficial(code))],
    ["Market rate: one mid rate", matches.filter((code) => !inList(code) && !isOfficial(code))]
  ];
  const nodes = [];

  groups.forEach(([title, codes]) => {
    if (codes.length) {
      nodes.push(element("h2", "group-title", title), ...codes.map(choiceButton));
    }
  });

  if (!nodes.length) {
    nodes.push(element("p", "empty", `No currency matches "${query}".`));
  }

  choices.replaceChildren(...nodes);

  if (focused) {
    choices.querySelector(`[data-code="${focused}"]`)?.focus();
  }
}


function toggleCurrency(code) {
  const removing = state.list.includes(code);

  state.list = removing
    ? state.list.filter((item) => item !== code)
    : [...state.list, code];

  if (removing && state.active === code) {
    state.active = "GHS";
    state.expression = "100";
    state.replace = true;
  }

  saveList();
  renderChoices();
}


function showPicker(open) {
  document.getElementById("converterScreen").hidden = open;
  document.getElementById("pickerScreen").hidden = !open;

  if (open) {
    document.getElementById("search").value = "";
    renderChoices();
    document.getElementById("closePicker").focus();
  } else {
    renderRows();
    document.getElementById("openPicker").focus();
  }
}


async function start() {
  renderKeypad();

  try {
    const response = await fetch("./rates.json");

    if (!response.ok) {
      throw new Error(`rates.json returned ${response.status}`);
    }

    state.data = await response.json();
  } catch (error) {
    document.getElementById("status").textContent =
      "Rates could not load. Check your connection and reload.";
    console.error(error);
    return;
  }

  state.list = loadList(state.data.rates);

  renderStatus();
  renderTable();
  renderCredits();
  setMode("selling");

  document.getElementById("buyingButton").addEventListener("click", () => setMode("buying"));
  document.getElementById("sellingButton").addEventListener("click", () => setMode("selling"));
  document.getElementById("openPicker").addEventListener("click", () => showPicker(true));
  document.getElementById("closePicker").addEventListener("click", () => showPicker(false));
  document.getElementById("search").addEventListener("input", renderChoices);
  document.addEventListener("keydown", handleKeyboard);
}


document.addEventListener("DOMContentLoaded", start);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(console.error);
}

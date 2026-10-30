// Calculator logic. Parses the expression itself and never uses eval.

const OPERATOR = /^[+\-×÷]$/;

function evalExpression(expression) {
  const tokens = (expression || "").match(/\d*\.?\d+%?|\d+\.%?|[+\-×÷]/g) || [];

  while (tokens.length && OPERATOR.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  if (!tokens.length) {
    return 0;
  }

  const read = (token) => ({
    value: parseFloat(token) / (token.endsWith("%") ? 100 : 1),
    percent: token.endsWith("%")
  });

  // Multiply and divide first, keeping add and subtract for the second pass.
  const terms = [read(tokens[0])];
  const signs = [];

  for (let i = 1; i < tokens.length; i += 2) {
    const operand = read(tokens[i + 1]);
    const last = terms[terms.length - 1];

    if (tokens[i] === "×") {
      last.value *= operand.value;
      last.percent = false;
    } else if (tokens[i] === "÷") {
      last.value /= operand.value;
      last.percent = false;
    } else {
      signs.push(tokens[i]);
      terms.push(operand);
    }
  }

  // As on a pocket calculator, 200 + 10% means 200 plus 10% of 200.
  let total = terms[0].value;

  for (let i = 1; i < terms.length; i++) {
    const part = terms[i].percent ? total * terms[i].value : terms[i].value;
    total = signs[i - 1] === "+" ? total + part : total - part;
  }

  return total;
}

function pressKey(expression, replace, key) {
  const next = (value, shouldReplace = false) => ({ expression: value, replace: shouldReplace });

  if (key === "C") {
    return next("");
  }

  if (key === "back") {
    return next(expression.slice(0, -1));
  }

  if (key === "=") {
    const total = evalExpression(expression);
    return next(Number.isFinite(total) ? String(Math.round(total * 1e6) / 1e6) : "", true);
  }

  if (OPERATOR.test(key)) {
    return expression ? next(expression.replace(/[+\-×÷]$/, "") + key) : next(expression, replace);
  }

  if (key === "%") {
    return /\d$/.test(expression) ? next(expression + "%") : next(expression, replace);
  }

  const base = replace ? "" : expression;

  if (base.length >= 24 || base.endsWith("%")) {
    return next(expression, replace);
  }

  if (key === ".") {
    const current = base.split(/[+\-×÷]/).pop();

    if (current.includes(".")) {
      return next(expression, replace);
    }

    return next(base + (current === "" ? "0." : "."));
  }

  return next(base + key);
}

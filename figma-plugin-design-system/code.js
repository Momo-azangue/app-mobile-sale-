async function loadFonts() {
  const fonts = [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Medium' },
    { family: 'Inter', style: 'Semi Bold' },
    { family: 'Inter', style: 'Bold' },
  ];

  for (const font of fonts) {
    await figma.loadFontAsync(font);
  }
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function solid(hex, opacity = 1) {
  return {
    type: 'SOLID',
    color: hexToRgb(hex),
    opacity,
  };
}

function setText(node, content, style) {
  node.fontName = style.fontName;
  node.fontSize = style.fontSize;
  node.lineHeight = style.lineHeight;
  node.characters = content;
}

function makeText(content, style, colorHex) {
  const node = figma.createText();
  setText(node, content, style);
  node.fills = [solid(colorHex)];
  return node;
}

function createPaintStyle(name, hex) {
  const style = figma.createPaintStyle();
  style.name = name;
  style.paints = [solid(hex)];
  return style;
}

function createTextStyle(name, options) {
  const style = figma.createTextStyle();
  style.name = name;
  style.fontName = options.fontName;
  style.fontSize = options.fontSize;
  style.lineHeight = options.lineHeight;
  return style;
}

function createEffectStyle(name, options) {
  const style = figma.createEffectStyle();
  style.name = name;
  style.effects = [
    {
      type: 'DROP_SHADOW',
      color: { ...hexToRgb(options.color), a: options.opacity },
      offset: { x: options.x, y: options.y },
      radius: options.blur,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];
  return style;
}

function createPage(name) {
  const page = figma.createPage();
  page.name = name;
  return page;
}

function createSectionTitle(page, title, y, textStyles, colorTokens) {
  const node = makeText(title, textStyles.h2, colorTokens.neutral900);
  node.x = 40;
  node.y = y;
  page.appendChild(node);
  return node;
}

function buildFoundationsPage(tokens, styles) {
  const page = createPage('Foundations');

  const title = makeText('Sales App Design System', styles.text.display, tokens.neutral900);
  title.x = 40;
  title.y = 40;
  page.appendChild(title);

  const subtitle = makeText('Color, typography, spacing, elevation', styles.text.bodyRegular, tokens.neutral600);
  subtitle.x = 40;
  subtitle.y = 90;
  page.appendChild(subtitle);

  createSectionTitle(page, 'Color Tokens', 150, styles.text, tokens);

  const colorGrid = figma.createFrame();
  colorGrid.layoutMode = 'VERTICAL';
  colorGrid.counterAxisSizingMode = 'AUTO';
  colorGrid.primaryAxisSizingMode = 'AUTO';
  colorGrid.itemSpacing = 8;
  colorGrid.x = 40;
  colorGrid.y = 190;
  colorGrid.name = 'Color Grid';
  colorGrid.fills = [];
  page.appendChild(colorGrid);

  Object.entries(tokens).forEach(([name, hex]) => {
    const row = figma.createFrame();
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisSizingMode = 'AUTO';
    row.counterAxisSizingMode = 'AUTO';
    row.itemSpacing = 12;
    row.fills = [];

    const swatch = figma.createRectangle();
    swatch.resize(32, 32);
    swatch.fills = [solid(hex)];
    swatch.cornerRadius = 8;

    const label = makeText(`${name}  ${hex}`, styles.text.label, tokens.neutral800);

    row.appendChild(swatch);
    row.appendChild(label);
    colorGrid.appendChild(row);
  });

  createSectionTitle(page, 'Typography Tokens', 580, styles.text, tokens);

  const typeFrame = figma.createFrame();
  typeFrame.layoutMode = 'VERTICAL';
  typeFrame.primaryAxisSizingMode = 'AUTO';
  typeFrame.counterAxisSizingMode = 'AUTO';
  typeFrame.itemSpacing = 12;
  typeFrame.fills = [];
  typeFrame.x = 40;
  typeFrame.y = 620;
  page.appendChild(typeFrame);

  const typographySamples = [
    ['Display/Large', styles.text.display],
    ['Heading/H1', styles.text.h1],
    ['Heading/H2', styles.text.h2],
    ['Body/Regular', styles.text.bodyRegular],
    ['Body/Medium', styles.text.bodyMedium],
    ['Label/Medium', styles.text.label],
    ['Caption/Regular', styles.text.caption],
  ];

  typographySamples.forEach(([label, textStyle]) => {
    const line = makeText(`${label} - The quick brown fox jumps over the lazy dog`, textStyle, tokens.neutral900);
    typeFrame.appendChild(line);
  });

  createSectionTitle(page, 'Spacing Tokens', 980, styles.text, tokens);

  const spacing = [4, 8, 12, 16, 24, 32, 40, 48];
  const spacingFrame = figma.createFrame();
  spacingFrame.layoutMode = 'HORIZONTAL';
  spacingFrame.primaryAxisSizingMode = 'AUTO';
  spacingFrame.counterAxisSizingMode = 'AUTO';
  spacingFrame.itemSpacing = 12;
  spacingFrame.fills = [];
  spacingFrame.x = 40;
  spacingFrame.y = 1020;
  page.appendChild(spacingFrame);

  spacing.forEach((value) => {
    const token = figma.createFrame();
    token.layoutMode = 'VERTICAL';
    token.primaryAxisSizingMode = 'AUTO';
    token.counterAxisSizingMode = 'AUTO';
    token.itemSpacing = 6;
    token.paddingLeft = 8;
    token.paddingRight = 8;
    token.paddingTop = 8;
    token.paddingBottom = 8;
    token.cornerRadius = 8;
    token.fills = [solid(tokens.neutral100)];

    const spacer = figma.createRectangle();
    spacer.resize(value, 12);
    spacer.fills = [solid(tokens.primary500)];

    const label = makeText(String(value), styles.text.caption, tokens.neutral700);

    token.appendChild(spacer);
    token.appendChild(label);
    spacingFrame.appendChild(token);
  });

  return page;
}

function createButtonVariant(type, state, size, styles, tokens, effectStyleId) {
  const component = figma.createComponent();
  component.name = `Type=${type}, State=${state}, Size=${size}`;
  component.layoutMode = 'HORIZONTAL';
  component.primaryAxisSizingMode = 'FIXED';
  component.counterAxisSizingMode = 'FIXED';
  component.primaryAxisAlignItems = 'CENTER';
  component.counterAxisAlignItems = 'CENTER';
  component.itemSpacing = 8;
  component.cornerRadius = 12;

  const width = size === 'LG' ? 164 : 136;
  const height = size === 'LG' ? 52 : 44;
  component.resize(width, height);

  const label = makeText(type === 'Primary' ? 'Primary CTA' : type === 'Secondary' ? 'Secondary' : 'Ghost', styles.text.label, tokens.neutral0);

  if (type === 'Primary') {
    component.fills = [solid(tokens.primary500, state === 'Disabled' ? 0.45 : 1)];
    component.strokes = [];
    label.fills = [solid(tokens.neutral0)];
  } else if (type === 'Secondary') {
    component.fills = [solid(tokens.neutral0, state === 'Disabled' ? 0.6 : 1)];
    component.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.primary500), opacity: state === 'Disabled' ? 0.4 : 1 }];
    component.strokeWeight = 1;
    label.fills = [solid(tokens.primary600, state === 'Disabled' ? 0.5 : 1)];
  } else {
    component.fills = [];
    component.strokes = [];
    label.fills = [solid(tokens.primary600, state === 'Disabled' ? 0.45 : 1)];
  }

  if (state !== 'Disabled') {
    component.effectStyleId = effectStyleId;
  }

  component.appendChild(label);
  return component;
}

function createInputVariant(state, styles, tokens) {
  const component = figma.createComponent();
  component.name = `State=${state}`;
  component.layoutMode = 'VERTICAL';
  component.primaryAxisSizingMode = 'FIXED';
  component.counterAxisSizingMode = 'AUTO';
  component.itemSpacing = 6;
  component.resize(320, 80);
  component.fills = [];

  const label = makeText('Label', styles.text.caption, tokens.neutral700);

  const field = figma.createFrame();
  field.layoutMode = 'HORIZONTAL';
  field.primaryAxisSizingMode = 'FIXED';
  field.counterAxisSizingMode = 'FIXED';
  field.primaryAxisAlignItems = 'MIN';
  field.counterAxisAlignItems = 'CENTER';
  field.paddingLeft = 12;
  field.paddingRight = 12;
  field.resize(320, 44);
  field.cornerRadius = 10;
  field.fills = [solid(tokens.neutral0)];

  let border = tokens.neutral300;
  if (state === 'Focus') border = tokens.primary500;
  if (state === 'Error') border = tokens.danger500;

  field.strokes = [{ type: 'SOLID', color: hexToRgb(border) }];
  field.strokeWeight = state === 'Focus' ? 2 : 1;

  const placeholder = makeText('Placeholder', styles.text.bodyRegular, tokens.neutral500);
  field.appendChild(placeholder);

  component.appendChild(label);
  component.appendChild(field);

  if (state === 'Error') {
    const helper = makeText('Message erreur', styles.text.caption, tokens.danger500);
    component.appendChild(helper);
  }

  return component;
}

function createCardStatVariant(type, styles, tokens, effectStyleId) {
  const component = figma.createComponent();
  component.name = `Tone=${type}`;
  component.layoutMode = 'VERTICAL';
  component.primaryAxisSizingMode = 'FIXED';
  component.counterAxisSizingMode = 'FIXED';
  component.itemSpacing = 6;
  component.paddingLeft = 14;
  component.paddingRight = 14;
  component.paddingTop = 14;
  component.paddingBottom = 14;
  component.resize(170, 106);
  component.cornerRadius = 12;

  if (type === 'Primary') {
    component.fills = [solid(tokens.primary50)];
    component.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.primary200) }];
  } else {
    component.fills = [solid(tokens.neutral0)];
    component.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.neutral200) }];
  }

  component.effectStyleId = effectStyleId;

  const title = makeText('KPI', styles.text.caption, tokens.neutral600);
  const value = makeText('2 345 €', styles.text.h2, tokens.neutral900);
  const meta = makeText('+12% vs hier', styles.text.caption, tokens.success600);

  component.appendChild(title);
  component.appendChild(value);
  component.appendChild(meta);
  return component;
}

function createSidebarComponent(styles, tokens, effectStyleId) {
  const component = figma.createComponent();
  component.name = 'Sidebar/Desktop';
  component.layoutMode = 'VERTICAL';
  component.primaryAxisSizingMode = 'FIXED';
  component.counterAxisSizingMode = 'FIXED';
  component.paddingLeft = 20;
  component.paddingRight = 20;
  component.paddingTop = 24;
  component.paddingBottom = 24;
  component.itemSpacing = 18;
  component.resize(260, 900);
  component.fills = [solid(tokens.neutral0)];
  component.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.neutral200) }];
  component.effectStyleId = effectStyleId;

  const brand = makeText('Sales Admin', styles.text.h2, tokens.primary600);
  component.appendChild(brand);

  const entries = ['Dashboard', 'Ventes', 'Stocks', 'Clients', 'Parametres'];
  entries.forEach((entry, index) => {
    const row = figma.createFrame();
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisSizingMode = 'FIXED';
    row.counterAxisSizingMode = 'AUTO';
    row.primaryAxisAlignItems = 'MIN';
    row.counterAxisAlignItems = 'CENTER';
    row.resize(220, 40);
    row.cornerRadius = 10;
    row.paddingLeft = 10;
    row.paddingRight = 10;
    row.fills = [solid(index === 0 ? tokens.primary50 : tokens.neutral0)];

    const label = makeText(entry, styles.text.bodyMedium, index === 0 ? tokens.primary700 : tokens.neutral700);
    row.appendChild(label);
    component.appendChild(row);
  });

  return component;
}

function createBottomNavComponent(styles, tokens) {
  const component = figma.createComponent();
  component.name = 'BottomNav/Mobile';
  component.layoutMode = 'HORIZONTAL';
  component.primaryAxisSizingMode = 'FIXED';
  component.counterAxisSizingMode = 'FIXED';
  component.primaryAxisAlignItems = 'SPACE_BETWEEN';
  component.counterAxisAlignItems = 'CENTER';
  component.paddingLeft = 20;
  component.paddingRight = 20;
  component.resize(390, 72);
  component.fills = [solid(tokens.neutral0)];
  component.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.neutral200) }];

  const items = ['Home', 'Ventes', 'Stocks', 'Clients'];
  items.forEach((label, index) => {
    const item = figma.createFrame();
    item.layoutMode = 'VERTICAL';
    item.primaryAxisSizingMode = 'AUTO';
    item.counterAxisSizingMode = 'AUTO';
    item.primaryAxisAlignItems = 'CENTER';
    item.counterAxisAlignItems = 'CENTER';
    item.itemSpacing = 4;
    item.fills = [];

    const dot = figma.createEllipse();
    dot.resize(8, 8);
    dot.fills = [solid(index === 0 ? tokens.primary500 : tokens.neutral400)];

    const text = makeText(label, styles.text.caption, index === 0 ? tokens.primary600 : tokens.neutral500);

    item.appendChild(dot);
    item.appendChild(text);
    component.appendChild(item);
  });

  return component;
}

function buildComponentsPage(tokens, styles) {
  const page = createPage('Components');

  createSectionTitle(page, 'Buttons', 40, styles.text, tokens);

  const buttons = [];
  const types = ['Primary', 'Secondary', 'Ghost'];
  const states = ['Default', 'Disabled'];
  const sizes = ['MD', 'LG'];

  types.forEach((type) => {
    states.forEach((state) => {
      sizes.forEach((size) => {
        buttons.push(createButtonVariant(type, state, size, styles, tokens, styles.effects.elevationSm.id));
      });
    });
  });

  const buttonSet = figma.combineAsVariants(buttons, page);
  buttonSet.name = 'Button';
  buttonSet.x = 40;
  buttonSet.y = 80;

  createSectionTitle(page, 'Inputs', 360, styles.text, tokens);

  const inputs = ['Default', 'Focus', 'Error'].map((state) => createInputVariant(state, styles, tokens));
  const inputSet = figma.combineAsVariants(inputs, page);
  inputSet.name = 'Input';
  inputSet.x = 40;
  inputSet.y = 400;

  createSectionTitle(page, 'KPI Cards', 700, styles.text, tokens);

  const cardVariants = ['Default', 'Primary'].map((tone) =>
    createCardStatVariant(tone, styles, tokens, styles.effects.elevationSm.id)
  );
  const cardSet = figma.combineAsVariants(cardVariants, page);
  cardSet.name = 'Card/Stat';
  cardSet.x = 40;
  cardSet.y = 740;

  createSectionTitle(page, 'Navigation', 1020, styles.text, tokens);

  const sidebar = createSidebarComponent(styles, tokens, styles.effects.elevationMd.id);
  sidebar.x = 40;
  sidebar.y = 1060;
  page.appendChild(sidebar);

  const bottomNav = createBottomNavComponent(styles, tokens);
  bottomNav.x = 360;
  bottomNav.y = 1060;
  page.appendChild(bottomNav);

  return { page, buttonSet, inputSet, cardSet, sidebar, bottomNav };
}

function findVariant(componentSet, contains) {
  const match = componentSet.children.find((node) => node.name.includes(contains));
  return match || componentSet.children[0];
}

function createMobileScreen(name, x, y, tokens) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(390, 844);
  frame.x = x;
  frame.y = y;
  frame.cornerRadius = 22;
  frame.clipsContent = true;
  frame.fills = [solid(tokens.neutral50)];
  frame.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.neutral300) }];
  return frame;
}

function buildAppScreensPage(tokens, styles, components) {
  const page = createPage('App Screens');

  createSectionTitle(page, 'Mobile', 40, styles.text, tokens);

  const login = createMobileScreen('Auth / Login', 40, 90, tokens);
  page.appendChild(login);

  const loginCard = figma.createFrame();
  loginCard.layoutMode = 'VERTICAL';
  loginCard.primaryAxisSizingMode = 'FIXED';
  loginCard.counterAxisSizingMode = 'FIXED';
  loginCard.itemSpacing = 12;
  loginCard.paddingLeft = 18;
  loginCard.paddingRight = 18;
  loginCard.paddingTop = 18;
  loginCard.paddingBottom = 18;
  loginCard.resize(330, 420);
  loginCard.x = 30;
  loginCard.y = 180;
  loginCard.cornerRadius = 16;
  loginCard.fills = [solid(tokens.neutral0)];
  loginCard.effectStyleId = styles.effects.elevationMd.id;

  const authTitle = makeText('Connexion', styles.text.h1, tokens.neutral900);
  const authSub = makeText('Acces back-office mobile', styles.text.bodyRegular, tokens.neutral600);

  const inputDefault = findVariant(components.inputSet, 'State=Default').createInstance();
  const inputPassword = findVariant(components.inputSet, 'State=Default').createInstance();
  inputPassword.name = 'Input / Password';

  const buttonPrimary = findVariant(components.buttonSet, 'Type=Primary, State=Default, Size=LG').createInstance();
  buttonPrimary.resize(294, 52);

  loginCard.appendChild(authTitle);
  loginCard.appendChild(authSub);
  loginCard.appendChild(inputDefault);
  loginCard.appendChild(inputPassword);
  loginCard.appendChild(buttonPrimary);
  login.appendChild(loginCard);

  const dashboard = createMobileScreen('Dashboard', 470, 90, tokens);
  page.appendChild(dashboard);

  const dashTitle = makeText('Tableau de bord', styles.text.h1, tokens.neutral900);
  dashTitle.x = 16;
  dashTitle.y = 20;
  dashboard.appendChild(dashTitle);

  const cardA = findVariant(components.cardSet, 'Tone=Primary').createInstance();
  cardA.x = 16;
  cardA.y = 80;
  dashboard.appendChild(cardA);

  const cardB = findVariant(components.cardSet, 'Tone=Default').createInstance();
  cardB.x = 204;
  cardB.y = 80;
  dashboard.appendChild(cardB);

  const chartBlock = figma.createFrame();
  chartBlock.resize(358, 220);
  chartBlock.x = 16;
  chartBlock.y = 206;
  chartBlock.cornerRadius = 14;
  chartBlock.fills = [solid(tokens.neutral0)];
  chartBlock.effectStyleId = styles.effects.elevationSm.id;
  const chartLabel = makeText('Evolution des ventes (7 jours)', styles.text.label, tokens.neutral700);
  chartLabel.x = 14;
  chartLabel.y = 14;
  chartBlock.appendChild(chartLabel);
  dashboard.appendChild(chartBlock);

  const navInstanceDash = components.bottomNav.createInstance();
  navInstanceDash.y = 772;
  dashboard.appendChild(navInstanceDash);

  const sales = createMobileScreen('Ventes', 900, 90, tokens);
  page.appendChild(sales);

  const salesTitle = makeText('Ventes', styles.text.h1, tokens.neutral900);
  salesTitle.x = 16;
  salesTitle.y = 20;
  sales.appendChild(salesTitle);

  const searchBar = figma.createFrame();
  searchBar.resize(358, 44);
  searchBar.x = 16;
  searchBar.y = 80;
  searchBar.cornerRadius = 12;
  searchBar.fills = [solid(tokens.neutral0)];
  searchBar.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.neutral300) }];
  const searchLabel = makeText('Rechercher un client...', styles.text.bodyRegular, tokens.neutral500);
  searchLabel.x = 12;
  searchLabel.y = 12;
  searchBar.appendChild(searchLabel);
  sales.appendChild(searchBar);

  for (let i = 0; i < 3; i += 1) {
    const saleCard = figma.createFrame();
    saleCard.resize(358, 98);
    saleCard.x = 16;
    saleCard.y = 140 + i * 112;
    saleCard.cornerRadius = 12;
    saleCard.fills = [solid(tokens.neutral0)];
    saleCard.effectStyleId = styles.effects.elevationSm.id;

    const customer = makeText(`Client ${i + 1}`, styles.text.bodyMedium, tokens.neutral900);
    customer.x = 12;
    customer.y = 12;
    saleCard.appendChild(customer);

    const amount = makeText(`${120 + i * 35} €`, styles.text.h2, tokens.neutral900);
    amount.x = 250;
    amount.y = 12;
    saleCard.appendChild(amount);

    sales.appendChild(saleCard);
  }

  const fab = figma.createEllipse();
  fab.resize(56, 56);
  fab.x = 318;
  fab.y = 700;
  fab.fills = [solid(tokens.primary500)];
  sales.appendChild(fab);

  const navInstanceSales = components.bottomNav.createInstance();
  navInstanceSales.y = 772;
  sales.appendChild(navInstanceSales);

  const stocks = createMobileScreen('Stocks', 1330, 90, tokens);
  page.appendChild(stocks);

  const stocksTitle = makeText('Gestion de stock', styles.text.h1, tokens.neutral900);
  stocksTitle.x = 16;
  stocksTitle.y = 20;
  stocks.appendChild(stocksTitle);

  for (let i = 0; i < 4; i += 1) {
    const productCard = figma.createFrame();
    productCard.resize(358, 96);
    productCard.x = 16;
    productCard.y = 80 + i * 106;
    productCard.cornerRadius = 12;
    productCard.fills = [solid(tokens.neutral0)];
    productCard.effectStyleId = styles.effects.elevationSm.id;

    const pName = makeText(`Produit ${i + 1}`, styles.text.bodyMedium, tokens.neutral900);
    pName.x = 12;
    pName.y = 10;
    productCard.appendChild(pName);

    const stock = makeText(`Stock: ${24 - i * 3}`, styles.text.caption, tokens.neutral700);
    stock.x = 12;
    stock.y = 40;
    productCard.appendChild(stock);

    stocks.appendChild(productCard);
  }

  const navInstanceStock = components.bottomNav.createInstance();
  navInstanceStock.y = 772;
  stocks.appendChild(navInstanceStock);

  const clients = createMobileScreen('Clients', 1760, 90, tokens);
  page.appendChild(clients);

  const clientsTitle = makeText('Clients', styles.text.h1, tokens.neutral900);
  clientsTitle.x = 16;
  clientsTitle.y = 20;
  clients.appendChild(clientsTitle);

  for (let i = 0; i < 5; i += 1) {
    const c = figma.createFrame();
    c.resize(358, 82);
    c.x = 16;
    c.y = 80 + i * 92;
    c.cornerRadius = 12;
    c.fills = [solid(tokens.neutral0)];
    c.effectStyleId = styles.effects.elevationSm.id;

    const name = makeText(`Client ${i + 1}`, styles.text.bodyMedium, tokens.neutral900);
    name.x = 12;
    name.y = 12;
    c.appendChild(name);

    const details = makeText('client@email.com', styles.text.caption, tokens.neutral600);
    details.x = 12;
    details.y = 42;
    c.appendChild(details);

    clients.appendChild(c);
  }

  const navInstanceClients = components.bottomNav.createInstance();
  navInstanceClients.y = 772;
  clients.appendChild(navInstanceClients);

  const settings = createMobileScreen('Parametres', 2190, 90, tokens);
  page.appendChild(settings);

  const settingsTitle = makeText('Parametres', styles.text.h1, tokens.neutral900);
  settingsTitle.x = 16;
  settingsTitle.y = 20;
  settings.appendChild(settingsTitle);

  const settingsCard = figma.createFrame();
  settingsCard.resize(358, 320);
  settingsCard.x = 16;
  settingsCard.y = 80;
  settingsCard.cornerRadius = 12;
  settingsCard.fills = [solid(tokens.neutral0)];
  settingsCard.effectStyleId = styles.effects.elevationSm.id;

  const sLabel = makeText('Informations boutique', styles.text.bodyMedium, tokens.neutral900);
  sLabel.x = 12;
  sLabel.y = 12;
  settingsCard.appendChild(sLabel);

  const sInput1 = findVariant(components.inputSet, 'State=Default').createInstance();
  sInput1.x = 12;
  sInput1.y = 48;
  settingsCard.appendChild(sInput1);

  const sInput2 = findVariant(components.inputSet, 'State=Default').createInstance();
  sInput2.x = 12;
  sInput2.y = 138;
  settingsCard.appendChild(sInput2);

  const sButton = findVariant(components.buttonSet, 'Type=Primary, State=Default, Size=LG').createInstance();
  sButton.x = 12;
  sButton.y = 248;
  sButton.resize(334, 52);
  settingsCard.appendChild(sButton);

  settings.appendChild(settingsCard);

  const navInstanceSettings = components.bottomNav.createInstance();
  navInstanceSettings.y = 772;
  settings.appendChild(navInstanceSettings);

  createSectionTitle(page, 'Desktop Shell', 980, styles.text, tokens);

  const desktopShell = figma.createFrame();
  desktopShell.name = 'Desktop / Dashboard';
  desktopShell.resize(1440, 900);
  desktopShell.x = 40;
  desktopShell.y = 1030;
  desktopShell.fills = [solid(tokens.neutral50)];
  desktopShell.strokes = [{ type: 'SOLID', color: hexToRgb(tokens.neutral300) }];
  desktopShell.cornerRadius = 18;

  const sidebarInstance = components.sidebar.createInstance();
  sidebarInstance.resize(260, 900);
  desktopShell.appendChild(sidebarInstance);

  const desktopContent = figma.createFrame();
  desktopContent.x = 280;
  desktopContent.y = 24;
  desktopContent.resize(1130, 852);
  desktopContent.cornerRadius = 14;
  desktopContent.fills = [solid(tokens.neutral0)];
  desktopContent.effectStyleId = styles.effects.elevationMd.id;

  const desktopTitle = makeText('Dashboard Admin', styles.text.h1, tokens.neutral900);
  desktopTitle.x = 24;
  desktopTitle.y = 24;
  desktopContent.appendChild(desktopTitle);

  desktopShell.appendChild(desktopContent);
  page.appendChild(desktopShell);

  return page;
}

async function main() {
  await loadFonts();

  const tokens = {
    primary700: '#312E81',
    primary600: '#4338CA',
    primary500: '#4F46E5',
    primary200: '#C7D2FE',
    primary100: '#E0E7FF',
    primary50: '#EEF2FF',
    neutral900: '#111827',
    neutral800: '#1F2937',
    neutral700: '#374151',
    neutral600: '#4B5563',
    neutral500: '#6B7280',
    neutral400: '#9CA3AF',
    neutral300: '#D1D5DB',
    neutral200: '#E5E7EB',
    neutral100: '#F3F4F6',
    neutral50: '#F9FAFB',
    neutral0: '#FFFFFF',
    success600: '#0F766E',
    success100: '#CCFBF1',
    warning600: '#B45309',
    warning100: '#FEF3C7',
    danger600: '#B91C1C',
    danger500: '#DC2626',
    danger100: '#FEE2E2',
  };

  const paintStyles = {};
  Object.entries(tokens).forEach(([name, hex]) => {
    paintStyles[name] = createPaintStyle(`Color/${name}`, hex);
  });

  const text = {
    display: createTextStyle('Typography/Display/Large', {
      fontName: { family: 'Inter', style: 'Bold' },
      fontSize: 32,
      lineHeight: { unit: 'PIXELS', value: 40 },
    }),
    h1: createTextStyle('Typography/Heading/H1', {
      fontName: { family: 'Inter', style: 'Bold' },
      fontSize: 24,
      lineHeight: { unit: 'PIXELS', value: 32 },
    }),
    h2: createTextStyle('Typography/Heading/H2', {
      fontName: { family: 'Inter', style: 'Semi Bold' },
      fontSize: 20,
      lineHeight: { unit: 'PIXELS', value: 28 },
    }),
    bodyRegular: createTextStyle('Typography/Body/Regular', {
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 16,
      lineHeight: { unit: 'PIXELS', value: 24 },
    }),
    bodyMedium: createTextStyle('Typography/Body/Medium', {
      fontName: { family: 'Inter', style: 'Medium' },
      fontSize: 16,
      lineHeight: { unit: 'PIXELS', value: 24 },
    }),
    label: createTextStyle('Typography/Label/Medium', {
      fontName: { family: 'Inter', style: 'Medium' },
      fontSize: 14,
      lineHeight: { unit: 'PIXELS', value: 20 },
    }),
    caption: createTextStyle('Typography/Caption/Regular', {
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 12,
      lineHeight: { unit: 'PIXELS', value: 16 },
    }),
  };

  const effects = {
    elevationSm: createEffectStyle('Effect/Elevation/Sm', {
      color: '#111827',
      opacity: 0.08,
      x: 0,
      y: 1,
      blur: 4,
    }),
    elevationMd: createEffectStyle('Effect/Elevation/Md', {
      color: '#111827',
      opacity: 0.12,
      x: 0,
      y: 6,
      blur: 18,
    }),
  };

  const styles = { paint: paintStyles, text, effects };

  const foundationsPage = buildFoundationsPage(tokens, styles);
  const components = buildComponentsPage(tokens, styles);
  const appPage = buildAppScreensPage(tokens, styles, components);

  figma.currentPage = appPage;
  figma.notify('Sales design system generated: Foundations, Components, App Screens.', { timeout: 4000 });

  // Keep selection on the first mobile frame for convenience
  const firstNode = appPage.children.find((n) => n.name === 'Auth / Login');
  if (firstNode) {
    figma.currentPage.selection = [firstNode];
    figma.viewport.scrollAndZoomIntoView([firstNode]);
  }

  figma.closePlugin();
}

main().catch((error) => {
  figma.notify(`Plugin failed: ${error.message || error}`);
  figma.closePlugin();
});


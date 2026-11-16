// Sidebar order. Each page maps to content/<section>/<slug>.md and is served at /<section>/<slug>
// (the introduction is served at /).
module.exports = [
  { id: 'getting-started', title: 'Getting Started', icon: 'flag', pages: [
    ['introduction', 'Introduction'],
    ['what-is-intercept', 'What is Intercept?'],
    ['why-intercept', 'Why Intercept?'],
    ['how-it-works', 'How It Works'],
    ['quickstart', 'Quickstart'],
  ] },
  { id: 'core-concepts', title: 'Core Concepts', icon: 'layers', pages: [
    ['architecture', 'Architecture'],
    ['agent-security', 'Agent Security'],
    ['risk-policies', 'Risk Policies'],
    ['transaction-lifecycle', 'Transaction Lifecycle'],
    ['execution-layer', 'Execution Layer'],
  ] },
  { id: 'risk-management', title: 'Risk Management', icon: 'gauge', pages: [
    ['overview', 'Overview'],
    ['exposure-limits', 'Exposure Limits'],
    ['position-sizing', 'Position Sizing'],
    ['leverage-controls', 'Leverage Controls'],
    ['drawdown-protection', 'Drawdown Protection'],
    ['liquidity-and-slippage', 'Liquidity & Slippage'],
    ['circuit-breakers', 'Circuit Breakers'],
  ] },
  { id: 'security', title: 'Security', icon: 'shield', pages: [
    ['overview', 'Overview'],
    ['transaction-firewall', 'Transaction Firewall'],
    ['threat-detection', 'Threat Detection'],
    ['prompt-injection-protection', 'Prompt Injection Protection'],
    ['smart-contract-risk', 'Smart Contract Risk'],
    ['permission-management', 'Permission Management'],
    ['emergency-controls', 'Emergency Controls'],
  ] },
  { id: 'network', title: 'Intercept Network', icon: 'network', pages: [
    ['overview', 'Overview'],
    ['threat-intelligence', 'Threat Intelligence'],
    ['security-operators', 'Security Operators'],
    ['threat-registry', 'Threat Registry'],
    ['collective-defense', 'Collective Defense'],
  ] },
  { id: 'developers', title: 'Developers', icon: 'code', pages: [
    ['integration-overview', 'Integration Overview'],
    ['sdk', 'SDK'],
    ['api-reference', 'API Reference'],
    ['configuration', 'Configuration'],
    ['error-handling', 'Error Handling'],
    ['webhooks', 'Webhooks'],
  ] },
  { id: 'resources', title: 'Resources', icon: 'book', pages: [
    ['roadmap', 'Roadmap'],
    ['faq', 'FAQ'],
    ['glossary', 'Glossary'],
  ] },
];

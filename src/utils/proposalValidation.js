const allowedDetails = new Set([
  'jobTitle',
  'phone',
  'country',
  'industry',
  'companySize',
  'serviceRequired',
  'estimatedBudget',
  'preferredTimeline',
  'expectedGoLive',
  'servicesOfInterest',
  'projectDescription',
]);

const allowedValues = {
  industry: [
    'Retail & E-commerce',
    'Healthcare & Pharma',
    'Manufacturing & Industrial',
    'Finance & Banking',
    'Technology & SaaS',
    'Logistics & Supply Chain',
    'Government & NGO',
    'Other',
  ],
  companySize: ['1 - 10', '11 - 50', '51 - 200', '201 - 500', '500+ employees'],
  serviceRequired: [
    'Artificial Intelligence & ML',
    'Business Intelligence & Data Analytics',
    'ERP (Odoo) Implementation',
    'Cloud Migration & Architecture',
    'Custom Software Development',
    'Digital Transformation',
  ],
  estimatedBudget: ['Under $2,000', '$2,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', '$25,000+'],
  preferredTimeline: ['Immediately', 'Within 30 Days', '1 - 3 Months', '3 - 6 Months', 'Flexible / Planning Stage'],
};

const allowedServices = [
  'AI Solutions',
  'Machine Learning',
  'Business Intelligence',
  'Cloud Computing',
  'ERP (Odoo)',
  'Microsoft Fabric',
  'Azure',
  'Data Warehousing',
  'Web Applications',
  'Mobile Applications',
  'Automation',
  'Managed Support',
];

const hasUnsafeText = (value) =>
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) || /<\/?[a-z][^>]*>/i.test(value);

function isOptionalText(value, maxLength) {
  return typeof value === 'string' &&
    value.trim().length <= maxLength &&
    !hasUnsafeText(value);
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return value >= new Date().toISOString().slice(0, 10);
}

export function isValidProposalDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
  if (Object.keys(details).some((key) => !allowedDetails.has(key))) return false;

  const limits = {
    jobTitle: 100,
    country: 100,
    projectDescription: 5000,
  };
  for (const [key, maxLength] of Object.entries(limits)) {
    if (details[key] !== undefined && !isOptionalText(details[key], maxLength)) return false;
  }

  if (details.phone !== undefined && details.phone !== '') {
    if (typeof details.phone !== 'string' || details.phone.length > 30 ||
      !/^\+?[0-9().\-\s]+$/.test(details.phone.trim())) return false;
    const digits = details.phone.replace(/\D/g, '').length;
    if (digits < 7 || digits > 15) return false;
  }

  for (const key of Object.keys(allowedValues)) {
    if (details[key] !== undefined && details[key] !== '' &&
      (typeof details[key] !== 'string' || !allowedValues[key].includes(details[key]))) return false;
  }

  if (details.expectedGoLive !== undefined && details.expectedGoLive !== '' &&
    !isValidDateOnly(details.expectedGoLive)) return false;

  if (details.servicesOfInterest !== undefined) {
    if (!Array.isArray(details.servicesOfInterest) || details.servicesOfInterest.length > allowedServices.length ||
      new Set(details.servicesOfInterest).size !== details.servicesOfInterest.length ||
      details.servicesOfInterest.some((service) => typeof service !== 'string' || !allowedServices.includes(service))) {
      return false;
    }
  }

  if (details.projectDescription && details.projectDescription.trim().length > 0 &&
    details.projectDescription.trim().length < 20) return false;

  return true;
}

export function normalizeProposalDetails(details) {
  if (!details) return details;
  return Object.fromEntries(Object.entries(details).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.trim() : value,
  ]));
}

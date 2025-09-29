import { type } from 'arktype';

const IndividualBillingSchema = type({
  plan: "'free'|'premium'|'enterprise'",
  paymentMethod: "'card'|'paypal'|'crypto'",
}).and(
  type({
    currency: 'string',
    billingAddress: {
      street: 'string',
      city: 'string',
      country: 'string',
    },
  })
);

const IndividualSchema = type({
  type: "'individual'",
  personalInfo: {
    name: 'string',
    middleName: 'string|null',
    age: 'number',
    preferences: {
      theme: "'light'|'dark'",
      notifications: {
        email: 'boolean',
        push: 'boolean',
        sms: 'boolean',
      },
    },
  },
  billing: IndividualBillingSchema,
});

const OrganizationSchema = type({
  type: "'organization'",
  orgInfo: {
    name: 'string',
    employees: type({
      name: 'string',
      role: "'admin'|'member'|'viewer'",
      permissions: {
        canEdit: 'boolean',
        canDelete: 'boolean',
        canInvite: 'boolean',
      },
    }).array(),
    settings: {
      visibility: "'public'|'private'",
      description: 'string?',
      features: {
        analytics: 'boolean',
        customBranding: 'boolean',
        apiAccess: 'boolean',
      },
    },
  },
});

export const schema = type({
  id: 'string',
  profile: IndividualSchema.or(OrganizationSchema),
  metadata: {
    createdAt: 'string',
    lastLogin: 'string',
    tags: 'string[]',
  },
});

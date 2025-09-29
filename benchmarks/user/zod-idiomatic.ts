import { z } from 'zod';

export const schema = z.object({
  id: z.string(),
  profile: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('individual'),
      personalInfo: z.object({
        name: z.string(),
        middleName: z.union([z.string(), z.null()]),
        age: z.number(),
        preferences: z.object({
          theme: z.union([z.literal('light'), z.literal('dark')]),
          notifications: z.object({
            email: z.boolean(),
            push: z.boolean(),
            sms: z.boolean(),
          }),
        }),
      }),
      billing: z.intersection(
        z.object({
          plan: z.union([z.literal('free'), z.literal('premium'), z.literal('enterprise')]),
          paymentMethod: z.union([z.literal('card'), z.literal('paypal'), z.literal('crypto')]),
        }),
        z.object({
          currency: z.string(),
          billingAddress: z.object({
            street: z.string(),
            city: z.string(),
            country: z.string(),
          }),
        })
      ),
    }),
    z.object({
      type: z.literal('organization'),
      orgInfo: z.object({
        name: z.string(),
        employees: z.array(
          z.object({
            name: z.string(),
            role: z.union([z.literal('admin'), z.literal('member'), z.literal('viewer')]),
            permissions: z.object({
              canEdit: z.boolean(),
              canDelete: z.boolean(),
              canInvite: z.boolean(),
            }),
          })
        ),
        settings: z.object({
          visibility: z.union([z.literal('public'), z.literal('private')]),
          description: z.string().optional(),
          features: z.object({
            analytics: z.boolean(),
            customBranding: z.boolean(),
            apiAccess: z.boolean(),
          }),
        }),
      }),
    }),
  ]),
  metadata: z.object({
    createdAt: z.string(),
    lastLogin: z.string(),
    tags: z.array(z.string()),
  }),
});

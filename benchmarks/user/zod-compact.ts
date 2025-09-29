import { number, string, boolean, object, discriminatedUnion, intersection, array, union, literal } from 'zod';

export const schema = object({
  id: string(),
  profile: discriminatedUnion('type', [
    object({
      type: literal('individual'),
      personalInfo: object({
        name: string(),
        middleName: string().nullable(),
        age: number(),
        preferences: object({
          theme: union([literal('light'), literal('dark')]),
          notifications: object({
            email: boolean(),
            push: boolean(),
            sms: boolean(),
          }),
        }),
      }),
      billing: intersection(
        object({
          plan: union([literal('free'), literal('premium'), literal('enterprise')]),
          paymentMethod: union([literal('card'), literal('paypal'), literal('crypto')]),
        }),
        object({
          currency: string(),
          billingAddress: object({
            street: string(),
            city: string(),
            country: string(),
          }),
        })
      ),
    }),
    object({
      type: literal('organization'),
      orgInfo: object({
        name: string(),
        employees: array(
          object({
            name: string(),
            role: union([literal('admin'), literal('member'), literal('viewer')]),
            permissions: object({
              canEdit: boolean(),
              canDelete: boolean(),
              canInvite: boolean(),
            }),
          })
        ),
        settings: object({
          visibility: union([literal('public'), literal('private')]),
          description: string().optional(),
          features: object({
            analytics: boolean(),
            customBranding: boolean(),
            apiAccess: boolean(),
          }),
        }),
      }),
    }),
  ]),
  metadata: object({
    createdAt: string(),
    lastLogin: string(),
    tags: array(string()),
  }),
});

import { array, boolean, define, intersection, nullable, number, string, union } from '@piuma/schema';

export const userSchema = define({
  id: string,
  profile: union(
    {
      type: 'individual',
      personalInfo: {
        name: string,
        middleName: nullable(string),
        age: number,
        preferences: {
          theme: union('light', 'dark'),
          notifications: {
            email: boolean,
            push: boolean,
            sms: boolean,
          },
        },
      },
      billing: intersection(
        {
          plan: union('free', 'premium', 'enterprise'),
          paymentMethod: union('card', 'paypal', 'crypto'),
        },
        {
          currency: string,
          billingAddress: {
            street: string,
            city: string,
            country: string,
          },
        }
      ),
    },
    {
      type: 'organization',
      orgInfo: {
        name: string,
        employees: array({
          name: string,
          role: union('admin', 'member', 'viewer'),
          permissions: {
            canEdit: boolean,
            canDelete: boolean,
            canInvite: boolean,
          },
        }),
        settings: {
          visibility: union('public', 'private'),
          'description?': string,
          features: {
            analytics: boolean,
            customBranding: boolean,
            apiAccess: boolean,
          },
        },
      },
    }
  ),
  metadata: {
    createdAt: string,
    lastLogin: string,
    tags: array(string),
  },
});

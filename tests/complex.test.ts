import * as assert from 'node:assert';
import { testBothModes } from './helpers';
import { userSchema } from './user-schema';

testBothModes('Complex Schema Tests', ({ test }) => {
  test('should validate complete individual user', () => {
    const validUser = {
      id: 'user123',
      profile: {
        type: 'individual',
        personalInfo: {
          name: 'John Doe',
          middleName: 'Michael',
          age: 30,
          preferences: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false,
              sms: true,
            },
          },
        },
        billing: {
          plan: 'premium',
          paymentMethod: 'card',
          currency: 'USD',
          billingAddress: {
            street: '123 Main St',
            city: 'New York',
            country: 'USA',
          },
        },
      },
      metadata: {
        createdAt: '2023-01-01',
        lastLogin: '2023-12-01',
        tags: ['vip', 'active'],
      },
    };

    const [result, errors] = userSchema.fix(validUser);

    assert.strictEqual(errors.length, 0);
    assert.strictEqual(userSchema.is(result), true);
    assert.deepStrictEqual(result, validUser);
  });

  test('should validate complete organization user', () => {
    const validOrg = {
      id: 'org456',
      profile: {
        type: 'organization',
        orgInfo: {
          name: 'Tech Corp',
          employees: [
            {
              name: 'Alice Admin',
              role: 'admin',
              permissions: {
                canEdit: true,
                canDelete: true,
                canInvite: true,
              },
            },
            {
              name: 'Bob Member',
              role: 'member',
              permissions: {
                canEdit: true,
                canDelete: false,
                canInvite: false,
              },
            },
          ],
          settings: {
            visibility: 'private',
            description: 'A private organization for tech development',
            features: {
              analytics: true,
              customBranding: true,
              apiAccess: false,
            },
          },
        },
      },
      metadata: {
        createdAt: '2023-02-01',
        lastLogin: '2023-12-02',
        tags: ['enterprise', 'tech'],
      },
    };

    const [result, errors] = userSchema.fix(validOrg);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(userSchema.is(result), true);
    assert.deepStrictEqual(result, validOrg);
  });

  test('should fix missing required fields and report errors', () => {
    const malformedUser = {
      profile: {
        type: 'individual',
        personalInfo: {
          middleName: 'TestMiddle',
          age: '30',
          preferences: {
            theme: 'blue',
            notifications: {
              email: true,
              push: false,
            },
          },
        },
        billing: {
          plan: 'basic',
          paymentMethod: 'card',
          currency: 'USD',
          billingAddress: {
            street: '123 Main St',
          },
        },
      },
      metadata: {
        createdAt: '2023-01-01',
        lastLogin: '2023-12-01',
        tags: 'not-array',
      },
    };

    const [result, errors] = userSchema.fix(malformedUser);

    assert.strictEqual(userSchema.is(result), true);

    assert.strictEqual(errors.length > 0, true);

    const errorMessages = errors.join('\n');

    assert.ok(errorMessages.includes('$: Missing key id'));
    assert.ok(errorMessages.includes('$.profile.personalInfo: Missing key name'));
    assert.ok(errorMessages.includes('$.profile.personalInfo.age: Expected number but got string'));
    assert.ok(errorMessages.includes('$.profile.personalInfo.preferences.theme: Unexpected string "blue" (allowed: "light" | "dark")'));
    assert.ok(errorMessages.includes('$.profile.personalInfo.preferences.notifications: Missing key sms'));
    assert.ok(errorMessages.includes('$.profile.billing.plan: Unexpected string "basic" (allowed: "free" | "premium" | "enterprise")'));
    assert.ok(errorMessages.includes('$.profile.billing.billingAddress: Missing key city'));
    assert.ok(errorMessages.includes('$.profile.billing.billingAddress: Missing key country'));
    assert.ok(errorMessages.includes('$.metadata.tags: Expected array but got string'));
  });

  test('should fix wrong profile type and nested structure', () => {
    const malformedUser = {
      id: 'user789',
      profile: {
        type: 'invalid_type',
        personalInfo: {
          name: 'Jane Doe',
          middleName: null,
          age: 25,
          preferences: {
            theme: 'light',
            notifications: {
              email: 'yes',
              push: 'no',
              sms: true,
            },
          },
        },
      },
      metadata: {
        createdAt: '2023-01-01',
        lastLogin: '2023-12-01',
        tags: [],
      },
    };

    const [result, errors] = userSchema.fix(malformedUser);

    assert.strictEqual(userSchema.is(result), true);
    assert.strictEqual(errors.length > 0, true);

    const errorMessages = errors.join('\n');

    assert.ok(errorMessages.includes('Object matches none of the possible structures'));
  });

  test('should fix array with wrong element types', () => {
    const malformedUser = {
      id: 'org999',
      profile: {
        type: 'organization',
        orgInfo: {
          name: 'Bad Corp',
          employees: [
            {
              name: 'Admin User',
              role: 'super_admin',
              permissions: {
                canEdit: 'true',
                canDelete: true,
                canInvite: true,
              },
            },
            'not-an-object',
            {
              role: 'member',
              permissions: {
                canEdit: true,
                canDelete: false,
              },
            },
          ],
          settings: {
            visibility: 'semi-private',
            features: {
              analytics: true,
              customBranding: true,
              apiAccess: false,
            },
          },
        },
      },
      metadata: {
        createdAt: '2023-02-01',
        lastLogin: '2023-12-02',
        tags: ['enterprise', 123, true],
      },
    };

    const [result, errors] = userSchema.fix(malformedUser);

    assert.strictEqual(userSchema.is(result), true);
    assert.strictEqual(errors.length > 0, true);

    const errorMessages = errors.join('\n');

    assert.ok(errorMessages.includes('$.profile.orgInfo.employees[0].role: Unexpected string "super_admin" (allowed: "admin" | "member" | "viewer")'));
    assert.ok(errorMessages.includes('$.profile.orgInfo.employees[0].permissions.canEdit: Expected boolean but got string'));
    assert.ok(errorMessages.includes('$.profile.orgInfo.employees[1]: Expected object but got string'));
    assert.ok(errorMessages.includes('$.profile.orgInfo.employees[2]: Missing key name'));
    assert.ok(errorMessages.includes('$.profile.orgInfo.employees[2].permissions: Missing key canInvite'));
    assert.ok(errorMessages.includes('$.profile.orgInfo.settings.visibility: Unexpected string "semi-private" (allowed: "public" | "private")'));
    assert.ok(errorMessages.includes('$.metadata.tags[1]: Expected string but got number'));
    assert.ok(errorMessages.includes('$.metadata.tags[2]: Expected string but got boolean'));
  });

  test('should handle null and undefined values', () => {
    const malformedUser = {
      id: null,
      profile: undefined,
      metadata: {
        createdAt: null,
        lastLogin: undefined,
        tags: null,
      },
    };

    const [result, errors] = userSchema.fix(malformedUser);

    assert.strictEqual(userSchema.is(result), true);
    assert.strictEqual(errors.length > 0, true);

    const errorMessages = errors.join('\n');
    assert.ok(errorMessages.includes('$.id: Expected string but got null'));
    assert.ok(errorMessages.includes('$.profile: Expected object but got undefined'));
    assert.ok(errorMessages.includes('$.metadata.createdAt: Expected string but got null'));
    assert.ok(errorMessages.includes('$.metadata.lastLogin: Expected string but got undefined'));
    assert.ok(errorMessages.includes('$.metadata.tags: Expected array but got null'));
  });

  test('should handle completely wrong input types', () => {
    const testCases = ['just a string', 123, true, {}, [], null, undefined];

    testCases.forEach((testCase, index) => {
      const [result, errors] = userSchema.fix(testCase);

      assert.strictEqual(userSchema.is(result), true, `Test case ${index} should produce valid result`);
      assert.strictEqual(errors.length > 0, true, `Test case ${index} should have errors`);

      const errorMessages = errors.join('\n');

      if (testCase !== null && testCase !== undefined && typeof testCase === 'object' && !Array.isArray(testCase)) {
        assert.ok(errorMessages.includes('Missing key'), `Test case ${index} should have missing key errors`);
      } else {
        assert.ok(errorMessages.includes('Expected object'), `Test case ${index} should have object type error`);
      }
    });
  });

  test('should handle deep nesting errors correctly', () => {
    const deepMalformed = {
      id: 'deep123',
      profile: {
        type: 'individual',
        personalInfo: {
          name: 'Deep User',
          middleName: 'Test',
          age: 25,
          preferences: {
            theme: 'light',
            notifications: {
              email: {
                enabled: true,
                frequency: 'daily',
              },
              push: false,
              sms: true,
            },
          },
        },
        billing: {
          plan: 'premium',
          paymentMethod: 'card',
          currency: 'USD',
          billingAddress: {
            street: '123 Main St',
            city: 'New York',
            country: 'USA',
          },
        },
      },
      metadata: {
        createdAt: '2023-01-01',
        lastLogin: '2023-12-01',
        tags: ['test'],
      },
    };

    const [result, errors] = userSchema.fix(deepMalformed);

    assert.strictEqual(userSchema.is(result), true);
    assert.strictEqual(errors.length > 0, true);

    const errorMessages = errors.join('\n');
    assert.ok(errorMessages.includes('$.profile.personalInfo.preferences.notifications.email: Expected boolean but got object'));
  });

  test('should handle union(string, constant(null)) field correctly', () => {
    const userWithStringMiddleName = {
      id: 'user001',
      profile: {
        type: 'individual',
        personalInfo: {
          name: 'Jane Doe',
          middleName: 'Elizabeth',
          age: 25,
          preferences: {
            theme: 'light',
            notifications: {
              email: true,
              push: true,
              sms: false,
            },
          },
        },
        billing: {
          plan: 'free',
          paymentMethod: 'paypal',
          currency: 'EUR',
          billingAddress: {
            street: '456 Oak St',
            city: 'Berlin',
            country: 'Germany',
          },
        },
      },
      metadata: {
        createdAt: '2023-03-01',
        lastLogin: '2023-12-03',
        tags: ['new', 'european'],
      },
    };

    const [result1, errors1] = userSchema.fix(userWithStringMiddleName);
    assert.strictEqual(errors1.length, 0);
    assert.strictEqual(userSchema.is(result1), true);
    assert.strictEqual((result1.profile as any).personalInfo.middleName, 'Elizabeth');

    const userWithNullMiddleName = {
      ...userWithStringMiddleName,
      profile: {
        ...userWithStringMiddleName.profile,
        personalInfo: {
          ...userWithStringMiddleName.profile.personalInfo,
          middleName: null,
        },
      },
    };

    const [result2, errors2] = userSchema.fix(userWithNullMiddleName);
    assert.strictEqual(errors2.length, 0);
    assert.strictEqual(userSchema.is(result2), true);
    assert.strictEqual((result2.profile as any).personalInfo.middleName, null);

    const userWithInvalidMiddleName = {
      ...userWithStringMiddleName,
      profile: {
        ...userWithStringMiddleName.profile,
        personalInfo: {
          ...userWithStringMiddleName.profile.personalInfo,
          middleName: 123,
        },
      },
    };

    const [result3, errors3] = userSchema.fix(userWithInvalidMiddleName);

    assert.strictEqual(userSchema.is(result3), true);
    assert.strictEqual(errors3.length > 0, true);

    const errorMessages = errors3.join('\n');
    assert.ok(errorMessages.includes('$.profile.personalInfo.middleName: Unexpected number'));
  });

  test('should handle optional fields correctly', () => {
    const orgWithDescription = {
      id: 'org001',
      profile: {
        type: 'organization',
        orgInfo: {
          name: 'Tech Solutions Inc',
          employees: [
            {
              name: 'Alice Johnson',
              role: 'admin',
              permissions: {
                canEdit: true,
                canDelete: true,
                canInvite: true,
              },
            },
          ],
          settings: {
            visibility: 'public',
            description: 'A cutting-edge technology company',
            features: {
              analytics: true,
              customBranding: false,
              apiAccess: true,
            },
          },
        },
      },
      metadata: {
        createdAt: '2023-04-01',
        lastLogin: '2023-12-04',
        tags: ['tech', 'startup'],
      },
    };

    const [result1, errors1] = userSchema.fix(orgWithDescription);
    assert.strictEqual(errors1.length, 0);
    assert.strictEqual(userSchema.is(result1), true);
    assert.strictEqual((result1.profile as any).orgInfo.settings.description, 'A cutting-edge technology company');

    const orgWithoutDescription = {
      ...orgWithDescription,
      profile: {
        ...orgWithDescription.profile,
        orgInfo: {
          ...orgWithDescription.profile.orgInfo,
          settings: {
            visibility: 'public',
            features: {
              analytics: true,
              customBranding: false,
              apiAccess: true,
            },
          },
        },
      },
    };

    const [result2, errors2] = userSchema.fix(orgWithoutDescription);
    assert.strictEqual(errors2.length, 0);
    assert.strictEqual(userSchema.is(result2), true);
    assert.strictEqual((result2.profile as any).orgInfo.settings.description, undefined);

    const orgWithInvalidDescription = {
      ...orgWithDescription,
      profile: {
        ...orgWithDescription.profile,
        orgInfo: {
          ...orgWithDescription.profile.orgInfo,
          settings: {
            visibility: 'public',
            description: 12345,
            features: {
              analytics: true,
              customBranding: false,
              apiAccess: true,
            },
          },
        },
      },
    };

    const [result3, errors3] = userSchema.fix(orgWithInvalidDescription);
    assert.strictEqual(userSchema.is(result3), true);
    assert.strictEqual(errors3.length > 0, true);

    const errorMessages = errors3.join('\n');
    assert.ok(errorMessages.includes('$.profile.orgInfo.settings.description: Expected string but got number'));
  });

  test('should handle missing middleName field (required union field)', () => {
    const userMissingMiddleName = {
      id: 'user002',
      profile: {
        type: 'individual',
        personalInfo: {
          name: 'Bob Smith',

          age: 35,
          preferences: {
            theme: 'dark',
            notifications: {
              email: false,
              push: true,
              sms: false,
            },
          },
        },
        billing: {
          plan: 'premium',
          paymentMethod: 'card',
          currency: 'USD',
          billingAddress: {
            street: '789 Pine St',
            city: 'San Francisco',
            country: 'USA',
          },
        },
      },
      metadata: {
        createdAt: '2023-05-01',
        lastLogin: '2023-12-05',
        tags: ['premium', 'us'],
      },
    };

    const [result, errors] = userSchema.fix(userMissingMiddleName);

    assert.strictEqual(userSchema.is(result), true);
    assert.strictEqual(errors.length > 0, true);

    const errorMessages = errors.join('\n');
    assert.ok(errorMessages.includes('$.profile.personalInfo: Missing key middleName'));
  });
});

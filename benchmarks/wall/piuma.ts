import { Tagged } from 'type-fest';
import { array, boolean, define, intersection, number, Schema, string, union } from '@piuma/schema';
import { testData } from './example-data';

function tagged<T, TagName extends PropertyKey>(schema: Schema<T>, tag: TagName) {
  return schema as Schema<Tagged<T, TagName>>;
}

function makeSchema() {
  const ImageSchema = define({
    key: string,
    uri: string,
    width: number,
    height: number,
    isBlurred: boolean,
    mainColor: string,
  });

  const WallItemBaseSchema = define({
    id: string,
    createdAt: tagged(string, 'AtomDate'),
  });

  const PrivacySchema = union({ privacy: 'public' }, { privacy: 'exclusive', isUnlocked: boolean, price: number });

  const RawPhotoSchema = intersection(
    define({
      type: 'photo',
      albumId: string,
      versions: array(ImageSchema),
    }).extend(WallItemBaseSchema),
    PrivacySchema
  );

  const RawNoteSchema = intersection(
    define({
      type: 'note',
      content: string,
    }).extend(WallItemBaseSchema),
    PrivacySchema
  );

  const RawAlbumSchema = intersection(
    define({
      type: 'album',
      title: string,
      content: array({ id: string, createdAt: string, versions: array(ImageSchema) }),
    }).extend(WallItemBaseSchema),
    PrivacySchema
  );

  const RawVideoSchema = intersection(
    define({
      type: 'video',
      caption: string,
      duration: number,
      previews: array(ImageSchema),
    }).extend(WallItemBaseSchema),
    PrivacySchema
  );

  const RawWallItemSchema = union(RawPhotoSchema, RawAlbumSchema, RawVideoSchema, RawNoteSchema);
  const RawWallData = array(RawWallItemSchema);

  return RawWallData;
}

export function schemaCreation(iterations: number) {
  for (let i = 0; i < iterations; i++) makeSchema();
}

export const schema = makeSchema();

export function validation(iterations: number) {
  for (let i = 0; i < iterations; i++) schema.validate(testData);
}

export function quick(iterations: number) {
  for (let i = 0; i < iterations; i++) schema.is(testData);
}

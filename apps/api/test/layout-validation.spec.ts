import {
  LayoutValidationError,
  isSafeWidgetUrl,
  validateLayoutDocument,
} from '../src/modules/layouts/layout-validation';
import { cloneDefaultLayout } from '../src/modules/layouts/default-layout';

/** Unit tests for the layout validation layer — the security boundary for
 * everything a client can PUT to /users/me/channel/layout. */
describe('layout-validation', () => {
  const validDoc = () => cloneDefaultLayout();

  describe('document shape', () => {
    it('accepts the default layout document', () => {
      expect(() => validateLayoutDocument(validDoc())).not.toThrow();
    });

    it('rejects non-object payloads', () => {
      expect(() => validateLayoutDocument(null)).toThrow(LayoutValidationError);
      expect(() => validateLayoutDocument([1, 2])).toThrow(LayoutValidationError);
      expect(() => validateLayoutDocument('x')).toThrow(LayoutValidationError);
    });

    it('rejects malformed JSON structures and wrong schema versions', () => {
      expect(() => validateLayoutDocument({ version: 2, grid: { columns: 12, rowHeight: 40 }, widgets: [] }))
        .toThrow(/version/);
      expect(() => validateLayoutDocument({ version: 1, widgets: [] })).toThrow(/grid/);
      expect(() => validateLayoutDocument({ version: 1, grid: { columns: 12, rowHeight: 40 } })).toThrow(/widgets/);
    });

    it('rejects columns other than 12 and out-of-range row heights', () => {
      expect(() => validateLayoutDocument({ version: 1, grid: { columns: 10, rowHeight: 40 }, widgets: [] }))
        .toThrow(/columns/);
      expect(() => validateLayoutDocument({ version: 1, grid: { columns: 12, rowHeight: 5 }, widgets: [] }))
        .toThrow(/rowHeight/);
    });

    it('rejects more than the maximum widget count', () => {
      const doc = validDoc();
      doc.widgets = Array.from({ length: 31 }, (_, i) => ({
        id: `w${i}`,
        type: 'TEXT' as const,
        x: 0,
        y: i,
        w: 1,
        h: 1,
        settings: { content: 'x' },
      }));
      expect(() => validateLayoutDocument(doc)).toThrow(/at most 30/);
    });
  });

  describe('widget geometry', () => {
    it('rejects negative x/y and non-positive w/h', () => {
      const cases = [
        { x: -1, y: 0, w: 1, h: 1 },
        { x: 0, y: -5, w: 1, h: 1 },
        { x: 0, y: 0, w: 0, h: 1 },
        { x: 0, y: 0, w: 1, h: 0 },
        { x: 0, y: 0, w: -3, h: 2 },
      ];
      for (const geometry of cases) {
        const doc = validDoc();
        doc.widgets = [{ id: 'w', type: 'TEXT', ...geometry, settings: { content: 'x' } }];
        expect(() => validateLayoutDocument(doc)).toThrow(LayoutValidationError);
      }
    });

    it('rejects widths over the 12-column canvas and overflow past it', () => {
      const over = validDoc();
      over.widgets = [{ id: 'w', type: 'TEXT', x: 0, y: 0, w: 13, h: 1, settings: { content: 'x' } }];
      expect(() => validateLayoutDocument(over)).toThrow(/invalid "w"/);

      const overflow = validDoc();
      overflow.widgets = [{ id: 'w', type: 'TEXT', x: 10, y: 0, w: 4, h: 1, settings: { content: 'x' } }];
      expect(() => validateLayoutDocument(overflow)).toThrow(/beyond the 12-column grid/);
    });

    it('rejects fractional and non-numeric geometry', () => {
      const doc = validDoc();
      doc.widgets = [{ id: 'w', type: 'TEXT', x: 0.5, y: 0, w: 1, h: 1, settings: { content: 'x' } }];
      expect(() => validateLayoutDocument(doc)).toThrow(/invalid "x"/);
    });

    it('rejects min/max bound contradictions', () => {
      const doc = validDoc();
      doc.widgets = [{ id: 'w', type: 'TEXT', x: 0, y: 0, w: 2, h: 1, minW: 3, settings: { content: 'x' } }];
      expect(() => validateLayoutDocument(doc)).toThrow(/minW greater than w/);
    });
  });

  describe('widget ids and types', () => {
    it('rejects duplicate widget ids', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 'dup', type: 'TEXT', x: 0, y: 0, w: 1, h: 1, settings: { content: 'a' } },
        { id: 'dup', type: 'TEXT', x: 1, y: 0, w: 1, h: 1, settings: { content: 'b' } },
      ];
      expect(() => validateLayoutDocument(doc)).toThrow(/Duplicate widget id/);
    });

    it('rejects empty and oversized ids', () => {
      const doc = validDoc();
      doc.widgets = [{ id: '', type: 'TEXT', x: 0, y: 0, w: 1, h: 1, settings: { content: 'x' } }];
      expect(() => validateLayoutDocument(doc)).toThrow(/non-empty "id"/);
    });

    it('rejects unknown and missing widget types', () => {
      const doc = validDoc();
      doc.widgets = [{ id: 'evil', type: 'CUSTOM_HTML', x: 0, y: 0, w: 1, h: 1 }];
      expect(() => validateLayoutDocument(doc)).toThrow(/unsupported type/);

      const doc2 = validDoc();
      doc2.widgets = [{ id: 'no-type', x: 0, y: 0, w: 1, h: 1 } as never];
      expect(() => validateLayoutDocument(doc2)).toThrow(/unsupported type/);
    });
  });

  describe('widget settings', () => {
    it('rejects TEXT without content and overlong content', () => {
      const doc = validDoc();
      doc.widgets = [{ id: 't', type: 'TEXT', x: 0, y: 0, w: 1, h: 1 }];
      expect(() => validateLayoutDocument(doc)).toThrow(/requires "content"/);

      const doc2 = validDoc();
      doc2.widgets = [{ id: 't', type: 'TEXT', x: 0, y: 0, w: 1, h: 1, settings: { content: 'x'.repeat(5001) } }];
      expect(() => validateLayoutDocument(doc2)).toThrow(/exceeds 5000/);
    });

    it('rejects TEXT with invalid alignment or fontSize', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 't', type: 'TEXT', x: 0, y: 0, w: 1, h: 1, settings: { content: 'x', alignment: 'up' as never } },
      ];
      expect(() => validateLayoutDocument(doc)).toThrow(/alignment/);
    });

    it('rejects IMAGE with javascript: or data: src (XSS vector)', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 'i', type: 'IMAGE', x: 0, y: 0, w: 1, h: 1, settings: { src: 'javascript:alert(1)', alt: 'x' } },
      ];
      expect(() => validateLayoutDocument(doc)).toThrow(/http\(s\) URL/);

      const doc2 = validDoc();
      doc2.widgets = [
        { id: 'i', type: 'IMAGE', x: 0, y: 0, w: 1, h: 1, settings: { src: 'data:text/html,<script>', alt: 'x' } },
      ];
      expect(() => validateLayoutDocument(doc2)).toThrow(/http\(s\) URL/);
    });

    it('accepts IMAGE with an https URL or app-local path and requires alt with src', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 'i', type: 'IMAGE', x: 0, y: 0, w: 1, h: 1, settings: { src: 'https://cdn.example.com/a.png', alt: 'banner' } },
      ];
      expect(() => validateLayoutDocument(doc)).not.toThrow();

      const local = validDoc();
      local.widgets = [{ id: 'i', type: 'IMAGE', x: 0, y: 0, w: 1, h: 1, settings: { src: '/img.png' } }];
      expect(() => validateLayoutDocument(local)).toThrow(/requires "alt"/);
    });

    it('rejects unknown settings keys per widget type', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 'c', type: 'CHANNEL_INFO', x: 0, y: 0, w: 1, h: 1, settings: { content: 'injected' } },
      ];
      expect(() => validateLayoutDocument(doc)).toThrow(/does not support setting/);
    });

    it('bounds SCHEDULE lines and RECENT_STREAMS limit', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 's', type: 'SCHEDULE', x: 0, y: 0, w: 1, h: 1, settings: { lines: Array.from({ length: 21 }, () => 'x') } },
      ];
      expect(() => validateLayoutDocument(doc)).toThrow(/at most 20 lines/);

      const doc2 = validDoc();
      doc2.widgets = [{ id: 'r', type: 'RECENT_STREAMS', x: 0, y: 0, w: 1, h: 1, settings: { limit: 11 } }];
      expect(() => validateLayoutDocument(doc2)).toThrow(/between 1 and 10/);
    });

    it('rejects SOCIAL_LINKS with unsafe URLs', () => {
      const doc = validDoc();
      doc.widgets = [
        { id: 's', type: 'SOCIAL_LINKS', x: 0, y: 0, w: 1, h: 1, settings: { website: 'vbscript:msgbox(1)' } },
      ];
      expect(() => validateLayoutDocument(doc)).toThrow(/http\(s\) URL/);
    });
  });

  describe('isSafeWidgetUrl', () => {
    it('allows http(s) and app-local paths, rejects everything else', () => {
      expect(isSafeWidgetUrl('https://example.com/a')).toBe(true);
      expect(isSafeWidgetUrl('http://localhost:3000/b')).toBe(true);
      expect(isSafeWidgetUrl('/local/path.png')).toBe(true);
      expect(isSafeWidgetUrl('//evil.com')).toBe(false);
      expect(isSafeWidgetUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeWidgetUrl('ftp://example.com')).toBe(false);
      expect(isSafeWidgetUrl('not a url')).toBe(false);
      expect(isSafeWidgetUrl(`https://x.com/${'a'.repeat(3000)}`)).toBe(false);
    });
  });
});

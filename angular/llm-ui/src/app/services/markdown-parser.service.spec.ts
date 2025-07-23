import { TestBed } from '@angular/core/testing';
import { MarkdownParserService } from './markdown-parser.service';
import { Root } from 'mdast'; // Ensure mdast types are available for testing

describe('MarkdownParserService', () => {
  let service: MarkdownParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarkdownParserService]
    });
    service = TestBed.inject(MarkdownParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('markdownToAst', () => {
    it('should convert simple markdown to AST', () => {
      const md = '# Hello';
      const ast = service.markdownToAst(md);
      expect(ast.type).toBe('root');
      expect(ast.children.length).toBe(1);
      const heading = ast.children[0];
      // Type assertion needed if not automatically inferred
      expect(heading.type).toBe('heading');
      expect((heading as any).depth).toBe(1);
      expect((heading as any).children[0].type).toBe('text');
      expect((heading as any).children[0].value).toBe('Hello');
    });

    it('should handle paragraphs', () => {
      const md = 'This is a paragraph.';
      const ast = service.markdownToAst(md);
      expect(ast.children.length).toBe(1);
      expect(ast.children[0].type).toBe('paragraph');
      expect((ast.children[0] as any).children[0].value).toBe('This is a paragraph.');
    });

    it('should handle bold and italic text', () => {
      const md = '**bold** and *italic*';
      const ast = service.markdownToAst(md);
      const paragraph = ast.children[0] as any;
      expect(paragraph.children[0].type).toBe('strong');
      expect(paragraph.children[0].children[0].value).toBe('bold');
      expect(paragraph.children[1].value).toBe(' and '); // Text node
      expect(paragraph.children[2].type).toBe('emphasis');
      expect(paragraph.children[2].children[0].value).toBe('italic');
    });
  });

  describe('astToMarkdown', () => {
    it('should convert a simple AST back to markdown', () => {
      // Create a simple AST
      const ast: Root = {
        type: 'root',
        children: [
          {
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: 'Test' }]
          }
        ]
      };
      const md = service.astToMarkdown(ast);
      expect(md.trim()).toBe('# Test'); // trim to remove potential trailing newline
    });
  });

  describe('removePartialAmbiguousMarkdown', () => {
    it('should remove trailing partial bold like **text*', () => {
      const md = 'Some text **partia';
      const cleaned = service.removePartialAmbiguousMarkdown(md);
      // Depending on the exact behavior of removePartialAmbiguousMarkdownFromAst and ENCLOSING_START_REGEX
      // This might be 'Some text ' or 'Some text'. Let's assume it removes the partial part.
      // Based on ENCLOSING_START_REGEX, it looks for * or _ or ~ followed by non-space.
      // '**partia' would match.
      expect(cleaned.trim()).toBe('Some text');
    });

    it('should remove trailing partial link like [link](http', () => {
      const md = 'A link [title](https://exam';
      const cleaned = service.removePartialAmbiguousMarkdown(md);
      expect(cleaned.trim()).toBe('A link');
    });
  });

  describe('markdownToVisibleText', () => {
    it('should convert basic markdown to visible text', () => {
      const md = '# Title\nParagraph with **bold** and _italic_.';
      // Expected: "TitleParagraph with bold and italic." (newlines are removed, markdown syntax is stripped)
      const visibleText = service.markdownToVisibleText(md, true); // isFinished = true
      expect(visibleText).toBe('TitleParagraph with bold and italic.');
    });

    it('should handle lists', () => {
      const md = '- Item 1\n- Item 2';
      // Expected: "*Item 1*Item 2" (LIST_ITEM_VISIBLE is '*')
      const visibleText = service.markdownToVisibleText(md, true);
      expect(visibleText).toBe('*Item 1*Item 2');
    });
  });

  describe('markdownWithVisibleChars', () => {
    it('should truncate markdown to the specified number of visible characters', () => {
      const md = 'This is a **long** sentence for testing.'; // Visible: "This is a long sentence for testing." (36 chars)
      const truncatedMd = service.markdownWithVisibleChars(md, 10, true); // Target 10 chars
      // Expected visible text: "This is a " (10 chars)
      // The function should return markdown that produces this visible text.
      // For "This is a ", the markdown is the same.
      expect(service.markdownToVisibleText(truncatedMd, true)).toBe('This is a ');
    });

    it('should handle complex markdown truncation', () => {
      const md = '# Hello *World*!'; // Visible: "Hello World!" (12 chars)
      const truncatedMd = service.markdownWithVisibleChars(md, 7, true); // Target "Hello W"
      expect(service.markdownToVisibleText(truncatedMd, true)).toBe('Hello W');
      // The actual markdown might be "# Hello *W*" or similar.
      // We are checking the visible text output of the truncated markdown.
    });
  });

});

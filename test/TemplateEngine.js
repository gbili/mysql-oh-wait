import { expect } from 'chai';
import TemplateEngine from '../src/TemplateEngine';

describe(`TemplateEngine`, function() {
  const refs = [
    'siteTitle',
    'nested.child',
    'nonExisting.data',
    'nested.nonExisting',
    'post.attributes.slug',
    'post.attributes.title',
    'post.attributes.nonExisting',
    'post.body',
  ];

  let parts = refs[6].split('.');
  parts.shift();
  let ref6WithoutPrefix = parts.join('.');

  const arrayRefs = [
    'posts'
  ];
  const mockTemplate = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>{{ ${refs[0]} }}</title>
        <meta name="description" content="Simplest Blog in Nodejs">
        <meta name="author" content="Guillermo Pages">
        <meta name="nested-child" content="{{ ${refs[1]} }}">
        <link rel="stylesheet" href="css/styles.css?v=1.0">
        <meta name="nested-child" content="{{ ${refs[2]} }}">
        <meta name="nested-child" content="{{ ${refs[3]} }}">
      </head>

      <body>
        <h1>{{ ${refs[0]} }}</h1>
        <ul>
          {{${arrayRefs[0]} as post
          <li><a href="/{{ ${refs[4]} }}">{{ ${refs[5]} }}</a><p>{{ ${refs[6]} }}</p><p>{{ ${refs[7]} }}</p></li>
          ${arrayRefs[0]}}}
        </ul>
      </body>
    </html>
    `;

  const mockData = {
    siteTitle: 'Guillermo.at',
    title: 'Home',
    nested: { child: 'this is nested' },
    posts: [
      {
        attributes: { title: 'My BlogPost', slug: 'my-blog-post' },
        body: '<p>Ain&#39;t it amazing?</p>\n<h2 id="code">Code</h2>\n<p>Look I can eve',
        frontmatter: 'title: My BlogPost'
      },
      {
        attributes: { title: 'My Other Blog Post', slug: 'my-other-blog-post' },
        body: '<p>Quite amazing indeed!</p>\n<h2 id="code">Code</h2>\n<p>Look I can eve',
        frontmatter: 'title: My Other Blog Post'
      },
    ],
  };

  const mockArrayReplaced = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>{{ ${refs[0]} }}</title>
        <meta name="description" content="Simplest Blog in Nodejs">
        <meta name="author" content="Guillermo Pages">
        <meta name="nested-child" content="{{ ${refs[1]} }}">
        <link rel="stylesheet" href="css/styles.css?v=1.0">
        <meta name="nested-child" content="{{ ${refs[2]} }}">
        <meta name="nested-child" content="{{ ${refs[3]} }}">
      </head>

      <body>
        <h1>{{ ${refs[0]} }}</h1>
        <ul>
          
          <li><a href="/${mockData.posts[0].attributes.slug}">${mockData.posts[0].attributes.title}</a><p>${ref6WithoutPrefix}</p><p>${mockData.posts[0].body}</p></li>
          
          <li><a href="/${mockData.posts[1].attributes.slug}">${mockData.posts[1].attributes.title}</a><p>${ref6WithoutPrefix}</p><p>${mockData.posts[1].body}</p></li>
          
        </ul>
      </body>
    </html>
    `;

  const te = new TemplateEngine();
  const teWithCallback = new TemplateEngine(ref => ref);

  describe(`getRefList(template)`, function() {
    it('should return a list of all references in the template', function() {
      expect(te.getRefList(mockTemplate)).to.be.an('array');
    });
    it('should return same amount of unique references in the template', function() {
      expect(te.getRefList(mockTemplate).length).to.be.equal(refs.length);
    });
    it('should return a list of all unique simple references in the template', function() {
      expect(te.getRefList(mockTemplate)).to.be.eql(refs);
    });
  });

  describe(`getNestedPath(dotNotation)`, function() {
    it('should return a an array', function() {
      expect(te.getNestedPath('this.is.an')).to.be.an('array');
    });
    it('should return an array with one more elements than dots in the string', function() {
      expect(te.getNestedPath('this.is.an').length).to.be.equal(3);
    });
    it('should return ["this", "is", "an"]', function() {
      expect(te.getNestedPath('this.is.an')).to.be.eql(["this", "is", "an"]);
    });
  });

  describe(`getReferencedValue(data, ref)`, function() {
    it('should access nested.child as data["nested"]["child"]', function() {
      expect(te.getReferencedValue(mockData, 'nested.child')).to.be.equal(mockData['nested']['child']);
    });
    it('should throw when trying to access non existing first level data', function() {
      const badRef = 'nonExisting.data';
      expect(() => te.getReferencedValue(mockData, badRef)).to.throw('Template references a data which is missing in the view, ref: ' + badRef);
    });
    it('should return missingRefCallbacks return on missing ref when constructed with missingRefCallback', function() {
      const badRef = 'nonExisting.data';
      expect(teWithCallback.getReferencedValue(mockData, badRef)).to.be.equal(badRef);
    });
    it('should return missingRefCallbacks return on missing ref when constructed with missingRefCallback on second level bad ref', function() {
      const badRef = 'nested.nonExisting';
      expect(teWithCallback.getReferencedValue(mockData, badRef)).to.be.equal(badRef);
    });
  });

  describe(`replaceRef(template, data, ref)`, function() {
    it('should replace all such references', function() {
      expect(te.replaceRef(mockTemplate, mockData, 'nested.child'))
        .to.be.equal(mockTemplate.replace('{{ nested.child }}', mockData['nested']['child']));
    });
  });

  describe(`replaceArray(template, data)`, function() {
    it('should throw if missing data ref using ref without element prefix', function() {
      expect(() => te.replaceArray(mockTemplate, mockData)).to.throw('Template references a data which is missing in the view, ref: ' + ref6WithoutPrefix);
    });
    it('should replace all non missing refs with proper data and missing with ones callback output', function() {
      expect(teWithCallback.replaceArray(mockTemplate, mockData)).to.be.equal(mockArrayReplaced);
    });
  });
});

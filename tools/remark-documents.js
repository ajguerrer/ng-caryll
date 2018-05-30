const fs = require('fs');
const extend = require('extend');
const path = require('path');
const glob = require('glob');
const requestImageSize = require('request-image-size');
const unified = require('unified');
const markdown = require('remark-parse');
const remark2rehype = require('remark-rehype');
const raw = require('rehype-raw');
const highlight = require('rehype-highlight');
const slug = require('rehype-slug');
const html = require('rehype-stringify');
const hast = require('hastscript');
const visit = require('unist-util-visit');
const isElement = require('hast-util-is-element');
const hasProperty = require('hast-util-has-property');

const INPUT_DIR = 'content/**';
const OUTPUT_DIR = 'src/assets/documents';

remarkDirectory(INPUT_DIR);

function remarkDirectory(path) {
  const files = glob.sync(path);
  const length = files.length;
  for (var i = 0; i < length; i++) {
    const stats = fs.lstatSync(files[i]);
    if (!stats.isDirectory()) {
      remarkFile(files[i]);
    }
  }
  return true;
}

function remarkFile(filePath) {
  const doc = fs.readFileSync(filePath).toString();
  unified()
    .use(markdown)
    .use(remark2rehype, { allowDangerousHTML: true })
    .use(raw)
    .use(highlight)
    .use(slug)
    .use(wrapInDiv, { className: "ngc-markdown" })
    .use(attachHeaderLink)
    .use(addImageDimensions)
    .use(html)
    .process(doc, function (err, file) {
      if (err) throw err;
      const output_file = path.basename(filePath.substring(0, filePath.lastIndexOf('.')));
      const stream = fs.createWriteStream(OUTPUT_DIR + '/' + output_file + '.html');
      stream.write(String(file));
      stream.end();
    });
}

function wrapInDiv(options) {
  const className = (options || {}).className;
  return function transformer(tree) {
    return hast('.' + className, [tree.children]);
  };
}

function attachHeaderLink() {
  const headings = ['h2', 'h3'];
  return function transformer(tree) {
    visit(tree, 'element', function (node) {
      if (isElement(node, headings) && hasProperty(node, 'id')) {
        extend(node.properties, { className: 'ngc-header-link' });
        node.children.unshift({
          type: 'element',
          tagName: 'span',
          properties: { 'header-link': node.properties.id }
        });
      }
    });
  };
}

function addImageDimensions() {
  return function transformer(tree, file, next) {
    var promises = [];
    visit(tree, 'element', function (node) {
      if (isElement(node, 'img')) {
        const props = node.properties;
        const src = props.src;
        if (src && props.width === undefined && props.height === undefined) {
          promises.push(requestImageSize(src)
            .then(function (size) {
              extend(props, { width: '' + size.width });
              extend(props, { height: '' + size.height });
            }));
        }
      }
    });
    Promise.all(promises).then(function () { next(); });
  };
}

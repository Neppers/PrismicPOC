var express = require('express');
var router = express.Router();
var Prismic = require('prismic.io').Prismic;

/* GET home page. */
router.get('/', function(req, res, next) {
  Prismic.Api('https://prospects-beta-test.prismic.io/api', function(err, Api) {
    Api.form('everything').ref(Api.master())
      .query(Prismic.Predicates.at("document.type", "article"))
      .fetchLinks()
      .submit(function(err, response) {
        var doc = response.results && response.results.length ? response.results[0] : undefined;
        res.render('index', {
            title: doc.getText('article.title'),
            shortlede: doc.getText('article.shortlede'),
            longlede: doc.getText('article.longlede'),
            content: doc.getStructuredText('article.content').asHtml(function(doc) {
                if (doc.isBroken) return false;
                console.log(doc);
                return "/test-url/" + doc.id + '/' + doc.slug;
            }, function(element, content) {
                if (element.type == "paragraph" && element.label == "blockquote") {
                    return '<blockquote>' + element.text + '</blockquote>';
                }
                if (element.type == "image" && element.label == "figure") {
                    return '<figure><img src="' + element.url + '" alt="' + element.alt + '"></figure>';
                }
                if (element.type == "embed") {
                    return '<div class="video-container">' + element.oembed.html + "</div>";
                }
                return null;
            })
        });
      });
  });
});

module.exports = router;

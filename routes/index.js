var express = require('express');
var router = express.Router();
var Prismic = require('prismic.io').Prismic;

var linkResolver = function(doc) {
  if (doc.isBroken) return false;
  return "/cvs-and-cover-letters/" + doc.slug;
}

var htmlSerializer = function(element, content) {
  if (element.type == "paragraph" && element.label == "blockquote") {
    return '<blockquote><p>' + element.text + '</p></blockquote>';
  }
  if (element.type == "image" && element.label == "figure") {
    return '<figure><img src="' + element.url + '" alt="' + element.alt + '"></figure>';
  }
  if (element.type == "embed") {
    return '<div class="video-container">' + element.oembed.html + "</div>";
  }
  if (element.type == "heading2") {
    return '<h2 id="' + slugIt(element.text) + '">' + element.text + '</h2>';
  }
  return null;
}

var slugIt = function(string) {
  return string.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
}

router.get('*', function(req, res, next) {
  var url = req.params[0].substr(1);

  var renderBasic = function(doc, author, widgets) {

    var skipLinks = [];

    if (doc.getText('basic.skiplinks') === "Yes") {
      var content = doc.getStructuredText('basic.content').blocks;
      for (var i = 0; i < content.length; i++) {
        if (content[i].type === "heading2") {
          skipLinks.push({
            text: content[i].text,
            anchor: slugIt(content[i].text)
          });
        }
      }
    }

    res.render('basic', {
      title: doc.getText('basic.title'),
      sectionTitle: doc.getText('basic.sectiontitle'),
      date: doc.getDate("basic.date"),
      author: author,
      widgets: widgets ? widgets : [],
      content: doc.getStructuredText('basic.content').asHtml(linkResolver, htmlSerializer),
      skipLinks: skipLinks,
      standFirst: (doc.getText('basic.standfirst') === "Yes")
    });
  }

  Prismic.Api('https://prospects-beta-test.prismic.io/api', function(err, Api) {
    Api.form('everything').ref(Api.master())
      .query(
        Prismic.Predicates.at("document.type", "basic"),
        Prismic.Predicates.at("my.basic.url", url)
      )
      .submit(function(err, response) {
        var doc = response.results && response.results.length ? response.results[0] : undefined;
        if (!doc) {
          next();
          return;
        }

        // Populate author
        var author = doc.getLink("basic.author");
        Api.form('everything').ref(Api.master())
          .query(Prismic.Predicates.at("document.id", author.id))
          .submit(function(err, response) {
            
            var author = response.results && response.results.length ? response.results[0] : undefined;
            author = {
              name: author.getText("author.full_name"),
              title: author.getText("author.title"),
              company: author.getText("author.company")
            }

            // Populate widgets
            var widgets = doc.getGroup("basic.widgets") ? doc.getGroup("basic.widgets").toArray() : [];

            var widgetIds = [];
            for (var i = 0; i < widgets.length; i++) {
              widgetIds.push(widgets[i].getLink("link").id);
            }

            if (widgetIds.length) {
              Api.form('everything').ref(Api.master())
                .query(Prismic.Predicates.any("document.id", widgetIds))
                .submit(function(err, response) {
                  widgetsSource = response.results && response.results.length ? response.results : undefined;
                  widgets = [];
                  for (var i = 0; i < widgetIds.length; i++) {
                    for (var n = 0; n < widgetsSource.length; n++) {
                      if (widgetsSource[n].id === widgetIds[i]) {
                        widgets.push(widgetsSource[n]);
                      }
                    }
                  }
                  renderBasic(doc, author, widgets);
                });
            } else {
              renderBasic(doc, author);
            }
          });
      });
  });
});

module.exports = router;
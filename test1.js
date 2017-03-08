async.waterfall([
  function convert(done) {
    // convert a single document
    document_conversion.convert(
      {
        // (JSON) ANSWER_UNITS, NORMALIZED_HTML, or NORMALIZED_TEXT
        file: fs.createReadStream(__dirname + inputDocument),
        conversion_target: 'ANSWER_UNITS',
        word: {
          heading: {
            fonts: [
              { level: 1, min_size: 28, max_size: 28, "bold": true, "name": "Adobe Garamond Pro" },
              { level: 2, min_size: 18, max_size: 18, "bold": true, "name": "Gill Sans MT" },
              { level: 3, min_size: 15, max_size: 15, "bold": true, "name": "Gill Sans MT" },
              { level: 4, min_size: 14, max_size: 14, "bold": true, "italic": true, "name": "Gill Sans MT" },
              { level: 5, min_size: 12, max_size: 12, "bold": true, "name": "Times New Roman" }
            ]
          }
        },
        // normalized_html: {
        //   // exclude_tags_completely: ["script", "sup"],
        //   // exclude_tags_keep_content: ["font", "em", "span"],
        //   // keep_content: {"xpaths":["//body/div[@id='content']"]},
        //   // exclude_content: {"xpaths":["//*[@id='footer']","//*[@id='navigation']"]},
        //   // keep_tag_attributes: ["*"]
        // },
        answer_units: {
          selectors: ['h1', 'h2', 'h3', 'h4', 'h5']
        }
      },
      function(err, response) {
        if (err) {
          console.error(err);
        } else {
          done(null, response);
        }
      }
    );
  },
  function indexAndCommit(response, done) {
    console.log('Indexing a document...');
    const doc = mapAnswerUnits2SolrDocs(response);
    solrClient.add(doc, function(err) {
      if (err) {
        console.log('Error indexing document: ' + err);
        done();
      } else {
        console.log('Indexed a document.');
        solrClient.commit(function(err) {
          if (err) {
            console.log('Error committing change: ' + err);
          } else {
            console.log('Successfully committed changes.');
          }
          done();
        });
      }
    });
  }
]);

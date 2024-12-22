;; Inject SQL in SQL-like commands
((comment) @injection.content
 (#match? @injection.content "^-- SQL")
 (#set! injection.language "sql"))

;; Inject Python in Python-like code blocks
((multi_line_string) @injection.content
 (#match? @injection.content "^'''python")
 (#set! injection.language "python"))

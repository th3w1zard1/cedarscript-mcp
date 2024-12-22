;; Keywords
[
  "WHEN"
  "THEN"
  "CASE"
  "END"
  "FILE"
  "CLASS"
  "FUNCTION"
  "METHOD"
  "VARIABLE"
] @keyword

;; String literals
(string) @string
(raw_string) @string
(single_quoted_string) @string
(multi_line_string) @string

;; Numbers
(number) @number

;; Comments
(comment) @comment

;; Function calls
(call_command) @function.call

;; Variables
(identifier_from_file) @variable

;; Types
(region_field) @type

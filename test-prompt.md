---
name: Test Prompt Template
description: This is a test prompt template for verifying frontmatter parsing
version: 1.0
author: Test User
---

# Test Prompt

Write a {{task | type=textarea | label=Task description | height=8}} for {{audience | type=text | default=General audience}}.

The tone should be {{tone | type=select | value=Formal | value=Neutral | value=Friendly | default=Neutral}}.

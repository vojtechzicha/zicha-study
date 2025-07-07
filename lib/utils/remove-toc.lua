-- Pandoc Lua filter to remove horizontal rules and static TOC entries
-- Based on the original remove-toc.lua from study-notes

function HorizontalRule()
  return {}
end

function Para(el)
  if #el.content == 1 and el.content[1].t == "Link" then
    return {}
  end
  return el
end
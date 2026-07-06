use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Frontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
}

/// Minimal YAML-frontmatter parser. Understands `key: value` (plain, single- or
/// double-quoted) and folds nothing else. Anything unparseable is ignored so a
/// skill never fails to index because of exotic YAML.
pub fn parse_frontmatter(content: &str) -> Frontmatter {
    let mut fm = Frontmatter::default();
    let Some(raw) = extract_block(content) else {
        return fm;
    };
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('-') || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = split_key_value(line) {
            let v = unquote(value.trim());
            match key {
                "name" => fm.name = opt(v),
                "description" | "short_description" => fm.description = opt(v),
                "author" | "publisher" => fm.author = opt(v),
                "version" => fm.version = opt(v),
                _ => {}
            }
        }
    }
    fm
}

fn extract_block(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.first().map(|l| l.trim() != "---").unwrap_or(true) {
        return None;
    }
    let end = lines.iter().skip(1).position(|l| l.trim() == "---")?;
    Some(lines[1..1 + end].join("\n"))
}

fn split_key_value(line: &str) -> Option<(&str, &str)> {
    let idx = line.find(':')?;
    let key = line[..idx].trim();
    if key.is_empty() || key.contains(' ') {
        return None;
    }
    Some((key, &line[idx + 1..]))
}

fn unquote(v: &str) -> String {
    let v = v.trim();
    if v.len() >= 2 {
        let b = v.as_bytes();
        if (b[0] == b'"' && b[v.len() - 1] == b'"') || (b[0] == b'\'' && b[v.len() - 1] == b'\'') {
            return v[1..v.len() - 1].to_string();
        }
    }
    v.to_string()
}

fn opt(v: String) -> Option<String> {
    if v.is_empty() || v == "\\" || v == "~" || v == "null" || v == "false" {
        None
    } else {
        Some(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_block() {
        let md = "---\nname: frontend-design\ndescription: \"Build great UI\"\nauthor: Vercel\n---\n\n# Hello";
        let fm = parse_frontmatter(md);
        assert_eq!(fm.name.as_deref(), Some("frontend-design"));
        assert_eq!(fm.description.as_deref(), Some("Build great UI"));
        assert_eq!(fm.author.as_deref(), Some("Vercel"));
    }

    #[test]
    fn single_quote_and_multiline() {
        let md = "---\nname: 'react'\nversion: 1.2.0\n---\nbody";
        let fm = parse_frontmatter(md);
        assert_eq!(fm.name.as_deref(), Some("react"));
        assert_eq!(fm.version.as_deref(), Some("1.2.0"));
    }

    #[test]
    fn no_frontmatter() {
        assert_eq!(parse_frontmatter("# just a doc").name, None);
    }

    #[test]
    fn malformed_never_panics() {
        let fm = parse_frontmatter("---\nname: a: b: : c\n**\n---\nx");
        assert!(fm.name.is_some() || fm.name.is_none());
    }
}
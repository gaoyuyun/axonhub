package llm

import (
	"mime"
	"path/filepath"
	"strings"

	"github.com/looplj/axonhub/llm/internal/pkg/xurl"
)

// File represents a generic file payload that can be forwarded across providers.
type File struct {
	// Kind preserves the semantic content block kind when a provider file ID
	// does not expose a MIME type. Common values are "image" and "document".
	Kind string `json:"kind,omitempty"`

	// Filename is the original filename when provided by the client.
	Filename string `json:"filename,omitempty"`

	// FileID is the upstream provider file identifier when the client references
	// an already uploaded file.
	FileID string `json:"file_id,omitempty"`

	// FileData is base64-encoded inline file data. Some clients may also send a
	// data URL here; helper methods normalize both forms.
	FileData string `json:"file_data,omitempty"`

	// URL is an externally accessible URL or a data URL for the file.
	URL string `json:"url,omitempty"`

	// MIMEType is the file MIME type when the client provides it.
	MIMEType string `json:"mime_type,omitempty"`

	// Detail controls how supported providers process file content, such as
	// PDF page images in the OpenAI Responses API.
	Detail *string `json:"detail,omitempty"`
}

// ResolvedMIMEType returns the best-effort MIME type inferred from the file
// metadata, data URL, filename, or URL path.
func (f *File) ResolvedMIMEType() string {
	if f == nil {
		return ""
	}

	if mimeType := strings.TrimSpace(f.MIMEType); mimeType != "" {
		return strings.ToLower(mimeType)
	}

	if parsed := xurl.ParseDataURL(f.URL); parsed != nil && parsed.MediaType != "" {
		return strings.ToLower(parsed.MediaType)
	}

	if parsed := xurl.ParseDataURL(f.FileData); parsed != nil && parsed.MediaType != "" {
		return strings.ToLower(parsed.MediaType)
	}

	for _, candidate := range []string{f.Filename, f.URL} {
		if mimeType := detectMIMETypeFromPath(candidate); mimeType != "" {
			return mimeType
		}
	}

	return ""
}

// InlineData returns raw base64 data when the file content is embedded inline.
func (f *File) InlineData() string {
	if f == nil {
		return ""
	}

	if parsed := xurl.ParseDataURL(f.FileData); parsed != nil {
		return parsed.Data
	}

	if strings.TrimSpace(f.FileData) != "" {
		return f.FileData
	}

	if parsed := xurl.ParseDataURL(f.URL); parsed != nil {
		return parsed.Data
	}

	return ""
}

// URLOrDataURL returns a regular URL when available, otherwise synthesizes a
// data URL from inline base64 content.
func (f *File) URLOrDataURL() string {
	if f == nil {
		return ""
	}

	if strings.TrimSpace(f.URL) != "" {
		return f.URL
	}

	data := f.InlineData()
	if data == "" {
		return ""
	}

	mimeType := f.ResolvedMIMEType()
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	return "data:" + mimeType + ";base64," + data
}

func detectMIMETypeFromPath(raw string) string {
	if raw == "" {
		return ""
	}

	path := raw
	if idx := strings.IndexAny(path, "?#"); idx >= 0 {
		path = path[:idx]
	}

	ext := strings.ToLower(filepath.Ext(path))
	if ext == "" {
		return ""
	}

	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		return ""
	}

	if idx := strings.IndexByte(mimeType, ';'); idx >= 0 {
		mimeType = mimeType[:idx]
	}

	return strings.ToLower(strings.TrimSpace(mimeType))
}

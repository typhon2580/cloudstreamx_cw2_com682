import { useEffect, useMemo, useState } from "react";
import {
  getAllMedia,
  createMedia,
  updateMedia,
  deleteMedia
} from "./api/mediaApi";
import "./styles.css";

const emptyForm = {
  id: "",
  title: "",
  description: "",
  tags: "",
  visibility: "public",
  originalFileName: "",
  blobName: "",
  blobUrl: "",
  mimeType: "",
  mediaType: "",
  size: 0,
  fileContentBase64: ""
};

const getFileExtension = (fileName) => {
  if (!fileName || !fileName.includes(".")) return "";
  return fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
};

const getMediaTypeFromMime = (mimeType) => {
  if (!mimeType) return "document";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
};

const formatFileSize = (bytes) => {
  if (!bytes) return "0 KB";

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const buildMediaPayload = (form) => {
  return {
    id: form.id,
    title: form.title.trim(),
    description: form.description.trim(),
    tags: form.tags
      ? form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [],
    visibility: form.visibility || "public",
    originalFileName: form.originalFileName,
    blobName: form.blobName,
    blobUrl:
      form.blobUrl ||
      `https://cloudstreamxstorage001.blob.core.windows.net/media/${form.blobName}`,
    mimeType: form.mimeType,
    mediaType: form.mediaType,
    size: Number(form.size) || 0,
    fileContentBase64: form.fileContentBase64
  };
};

function App() {
  const [activePage, setActivePage] = useState("home");
  const [media, setMedia] = useState([]);
  const [filteredType, setFilteredType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const goToPage = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadMedia = async () => {
    try {
      setLoading(true);
      const items = await getAllMedia();
      const visibleItems = items.filter((item) => item.isDeleted !== true);
      setMedia(visibleItems);
    } catch (error) {
      showToast("error", error.message || "Failed to load media.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const stats = useMemo(() => {
    return {
      total: media.length,
      images: media.filter((item) => item.mediaType === "image").length,
      videos: media.filter((item) => item.mediaType === "video").length,
      audio: media.filter((item) => item.mediaType === "audio").length,
      documents: media.filter((item) => item.mediaType === "document").length
    };
  }, [media]);

  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      const matchesType =
        filteredType === "all" || item.mediaType === filteredType;

      const searchableText = [
        item.title,
        item.description,
        item.id,
        item.blobName,
        item.originalFileName,
        item.mimeType,
        ...(Array.isArray(item.tags) ? item.tags : [])
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesType && searchableText.includes(searchTerm.toLowerCase().trim())
      );
    });
  }, [media, filteredType, searchTerm]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const maxSizeInMB = 8;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

    if (file.size > maxSizeInBytes) {
      showToast(
        "error",
        `File is too large. Please upload a file smaller than ${maxSizeInMB}MB for the demo.`
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      const cleanId = crypto.randomUUID();
      const extension = getFileExtension(file.name);
      const blobName = `${cleanId}${extension}`;
      const mimeType = file.type || "application/octet-stream";
      const mediaType = getMediaTypeFromMime(mimeType);

      setForm((previous) => ({
        ...previous,
        id: cleanId,
        originalFileName: file.name,
        blobName,
        blobUrl: `https://cloudstreamxstorage001.blob.core.windows.net/media/${blobName}`,
        mimeType,
        mediaType,
        size: file.size,
        fileContentBase64: base64
      }));

      showToast("success", `${file.name} selected successfully.`);
    };

    reader.onerror = () => {
      showToast("error", "Failed to read selected file.");
    };

    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();

    if (!form.fileContentBase64) {
      showToast("error", "Please choose a media file first.");
      return;
    }

    if (!form.title.trim()) {
      showToast("error", "Title is required.");
      return;
    }

    try {
      setLoading(true);
      const payload = buildMediaPayload(form);
      await createMedia(payload);

      showToast(
        "success",
        "Media uploaded to Blob Storage and metadata saved through Logic Apps."
      );

      setForm(emptyForm);
      goToPage("gallery");
      await loadMedia();
    } catch (error) {
      showToast("error", error.message || "Failed to upload media.");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : ""
    });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditingItem((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleUpdateSubmit = async (event) => {
    event.preventDefault();

    if (!editingItem?.title?.trim()) {
      showToast("error", "Title is required.");
      return;
    }

    try {
      setLoading(true);

      const updatedPayload = {
        ...editingItem,
        title: editingItem.title.trim(),
        description: editingItem.description || "",
        tags: editingItem.tags
          ? editingItem.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
          : [],
        updatedAt: new Date().toISOString()
      };

      delete updatedPayload._rid;
      delete updatedPayload._self;
      delete updatedPayload._etag;
      delete updatedPayload._attachments;
      delete updatedPayload._ts;
      delete updatedPayload.fileContentBase64;

      await updateMedia(editingItem.id, updatedPayload);

      showToast("success", "Media metadata updated successfully.");
      setEditingItem(null);
      await loadMedia();
    } catch (error) {
      showToast("error", error.message || "Failed to update media.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setLoading(true);
      await deleteMedia(deleteTarget.id);

      showToast("success", "Media deleted successfully using Logic Apps.");
      setDeleteTarget(null);
      await loadMedia();
    } catch (error) {
      showToast("error", error.message || "Failed to delete media.");
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = (item) => {
    if (item.mediaType === "image") {
      return (
        <img
          src={item.blobUrl}
          alt={item.title}
          className="media-preview"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      );
    }

    if (item.mediaType === "video") {
      return (
        <video className="media-preview" controls>
          <source src={item.blobUrl} type={item.mimeType} />
          Your browser does not support the video tag.
        </video>
      );
    }

    if (item.mediaType === "audio") {
      return (
        <div className="audio-preview">
          <span>AUDIO</span>
          <audio controls>
            <source src={item.blobUrl} type={item.mimeType} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    return (
      <div className="document-preview">
        <span>DOC</span>
        <p>{item.originalFileName || "Document file"}</p>
        {item.blobUrl && (
          <a href={item.blobUrl} target="_blank" rel="noreferrer">
            Open document
          </a>
        )}
      </div>
    );
  };

  const navButton = (page, label) => (
    <button
      className={activePage === page ? "active" : ""}
      onClick={() => goToPage(page)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="app">
      <nav className="top-nav">
        <button className="brand brand-button" onClick={() => goToPage("home")}>
          <span className="brand-icon">☁</span>
          <div>
            <h1>CloudStreamX</h1>
            <p>Azure Logic Apps Media Platform</p>
          </div>
        </button>

        <button
          className="mobile-menu-btn"
          type="button"
          onClick={() => setMobileMenuOpen((previous) => !previous)}
        >
          {mobileMenuOpen ? "Close" : "Menu"}
        </button>

        <div className={`nav-links ${mobileMenuOpen ? "open" : ""}`}>
          {navButton("home", "Home")}
          {navButton("gallery", "Gallery")}
          {navButton("upload", "Upload")}
          {navButton("evidence", "Azure Evidence")}
        </div>

        <button className="signin-btn" type="button">
          Sign in
        </button>
      </nav>

      {toast && (
        <div className={`toast ${toast.type}`}>
          <strong>{toast.type === "success" ? "Success" : "Error"}</strong>
          <span>{toast.message}</span>
        </div>
      )}

      {loading && (
        <div className="loading-bar">
          <span>Processing Azure Logic App request...</span>
        </div>
      )}

      <main>
        {activePage === "home" && (
          <section className="home-page home-page-simple">
            <div className="home-content">
              <span className="eyebrow">COM682 Cloud Native Development</span>
              <h2>Serverless multimedia sharing with Microsoft Azure</h2>
              <p>
                CloudStreamX uploads image, video, audio and document files to
                Azure Blob Storage, stores metadata in Azure Cosmos DB, and
                exposes RESTful CRUD operations through Azure Logic Apps.
              </p>

              <div className="home-actions">
                <button onClick={() => goToPage("upload")} type="button">
                  Upload Media
                </button>
                <button
                  className="secondary"
                  onClick={() => goToPage("gallery")}
                  type="button"
                >
                  View Gallery
                </button>
              </div>

              <div className="feature-pills">
                <span>Logic Apps</span>
                <span>Blob Storage</span>
                <span>Cosmos DB</span>
                <span>Application Insights</span>
              </div>
            </div>
          </section>
        )}

        {activePage === "gallery" && (
          <section className="page-section">
            <div className="section-header">
              <div>
                <span className="eyebrow">Gallery</span>
                <h2>Media Gallery</h2>
                <p>
                  Browse uploaded media records retrieved from Azure Cosmos DB
                  through Azure Logic Apps.
                </p>
              </div>
              <button onClick={loadMedia} type="button">
                Refresh
              </button>
            </div>

            <div className="stats-grid five">
              <div className="stat-card">
                <span>Total Media</span>
                <strong>{stats.total}</strong>
              </div>
              <div className="stat-card">
                <span>Images</span>
                <strong>{stats.images}</strong>
              </div>
              <div className="stat-card">
                <span>Videos</span>
                <strong>{stats.videos}</strong>
              </div>
              <div className="stat-card">
                <span>Audio</span>
                <strong>{stats.audio}</strong>
              </div>
              <div className="stat-card">
                <span>Documents</span>
                <strong>{stats.documents}</strong>
              </div>
            </div>

            <div className="toolbar">
              <input
                type="search"
                placeholder="Search title, ID, file name or tags..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <select
                value={filteredType}
                onChange={(event) => setFilteredType(event.target.value)}
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="document">Documents</option>
              </select>
            </div>

            <div className="media-grid">
              {filteredMedia.length === 0 ? (
                <div className="empty-state">
                  <h3>No media found</h3>
                  <p>Upload a media file or adjust your filters.</p>
                </div>
              ) : (
                filteredMedia.map((item) => (
                  <article className="media-card" key={item.id}>
                    <div className="preview-wrap">{renderPreview(item)}</div>

                    <div className="media-body">
                      <div className="card-title-row">
                        <h3>{item.title}</h3>
                        <span className={`badge ${item.mediaType}`}>
                          {item.mediaType}
                        </span>
                      </div>

                      <p className="description">{item.description}</p>

                      <div className="tags">
                        {Array.isArray(item.tags) &&
                          item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>

                      <div className="meta-list">
                        <p>
                          <strong>Original File:</strong> {item.originalFileName}
                        </p>
                        <p>
                          <strong>Type:</strong> {item.mimeType}
                        </p>
                        <p>
                          <strong>Size:</strong> {formatFileSize(item.size)}
                        </p>
                        <p>
                          <strong>Visibility:</strong> {item.visibility}
                        </p>

                        <details className="technical-metadata">
                          <summary>Technical Metadata</summary>
                          <p>
                            <strong>Media ID:</strong> {item.id}
                          </p>
                          <p>
                            <strong>Blob Name:</strong> {item.blobName}
                          </p>
                        </details>
                      </div>

                      <div className="card-actions">
                        <button onClick={() => openEditModal(item)} type="button">
                          Edit
                        </button>
                        <button
                          className="danger"
                          onClick={() => setDeleteTarget(item)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activePage === "upload" && (
          <section className="page-section narrow">
            <div className="section-header">
              <div>
                <span className="eyebrow">Upload</span>
                <h2>Upload Media</h2>
                <p>
                  Select an image, video, audio or document file. The file is
                  uploaded to Blob Storage and its metadata is saved to Cosmos DB.
                </p>
              </div>
            </div>

            <form className="form-card" onSubmit={handleCreateSubmit}>
              <div className="upload-dropzone">
                <strong>Choose multimedia file</strong>
                <p>
                  Supported: image, video, audio, PDF, DOCX and TXT. Demo limit:
                  8MB.
                </p>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileChange}
                  required
                />
              </div>

              <div className="form-grid">
                <label>
                  Media ID
                  <input value={form.id} placeholder="Auto-generated" readOnly />
                </label>

                <label>
                  Title *
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleInputChange}
                    placeholder="CloudStreamX demo media"
                    required
                  />
                </label>

                <label className="full">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleInputChange}
                    placeholder="Describe this media item..."
                  />
                </label>

                <label>
                  Tags
                  <input
                    name="tags"
                    value={form.tags}
                    onChange={handleInputChange}
                    placeholder="azure, logicapps, cw2"
                  />
                </label>

                <label>
                  Visibility
                  <select
                    name="visibility"
                    value={form.visibility}
                    onChange={handleInputChange}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>

                <label>
                  Original File Name
                  <input value={form.originalFileName} readOnly />
                </label>

                <label>
                  Blob Name
                  <input value={form.blobName} readOnly />
                </label>

                <label>
                  MIME Type
                  <input value={form.mimeType} readOnly />
                </label>

                <label>
                  Media Type
                  <input value={form.mediaType} readOnly />
                </label>

                <label className="full">
                  Blob URL
                  <input value={form.blobUrl} readOnly />
                </label>

                <label>
                  Size
                  <input value={formatFileSize(form.size)} readOnly />
                </label>
              </div>

              <button className="submit-btn" type="submit">
                Upload Media File
              </button>
            </form>
          </section>
        )}

        {activePage === "evidence" && (
          <section className="page-section">
            <div className="section-header">
              <div>
                <span className="eyebrow">Azure Evidence</span>
                <h2>Cloud Native Architecture</h2>
                <p>
                  This section supports your video demonstration by clearly
                  listing the Azure services used in the solution.
                </p>
              </div>
            </div>

            <div className="evidence-grid">
              <div className="evidence-card">
                <h3>Azure Logic Apps</h3>
                <p>
                  RESTful workflows for GET, POST, PUT and DELETE media
                  operations.
                </p>
              </div>

              <div className="evidence-card">
                <h3>Azure Blob Storage</h3>
                <p>
                  Stores uploaded image, video, audio and document files in the
                  media container.
                </p>
              </div>

              <div className="evidence-card">
                <h3>Azure Cosmos DB</h3>
                <p>
                  Stores metadata such as clean ID, blob name, file type, tags
                  and timestamps.
                </p>
              </div>

              <div className="evidence-card">
                <h3>Application Insights</h3>
                <p>
                  Provides monitoring evidence for requests, runs and platform
                  behaviour.
                </p>
              </div>
            </div>

            <div className="architecture-box">
              <h3>Architecture Flow</h3>
              <pre>{`React Frontend
   ↓
Azure Logic Apps REST Endpoints
   ↓
Azure Blob Storage stores files
   ↓
Azure Cosmos DB stores metadata
   ↓
Application Insights / Azure Monitor`}</pre>
            </div>
          </section>
        )}
      </main>

      {editingItem && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUpdateSubmit}>
            <h2>Edit Media Metadata</h2>

            <label>
              Title
              <input
                name="title"
                value={editingItem.title}
                onChange={handleEditChange}
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={editingItem.description || ""}
                onChange={handleEditChange}
              />
            </label>

            <label>
              Tags
              <input
                name="tags"
                value={editingItem.tags || ""}
                onChange={handleEditChange}
              />
            </label>

            <label>
              Visibility
              <select
                name="visibility"
                value={editingItem.visibility || "public"}
                onChange={handleEditChange}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>

            <div className="modal-actions">
              <button type="button" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
              <button type="submit">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Delete Media?</h2>
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.title}</strong>?
            </p>
            <p className="warning-text">
              This will call your DELETE Azure Logic App endpoint.
            </p>

            <div className="modal-actions">
              <button type="button" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="danger" type="button" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
const LOGIC_APP_URLS = {
  getAll: import.meta.env.VITE_GET_ALL_MEDIA_URL,
  getById: import.meta.env.VITE_GET_MEDIA_BY_ID_URL,
  create: import.meta.env.VITE_CREATE_MEDIA_URL,
  update: import.meta.env.VITE_UPDATE_MEDIA_URL,
  delete: import.meta.env.VITE_DELETE_MEDIA_URL
};

const validateLogicAppUrl = (url, name) => {
  if (!url || url.trim() === "") {
    throw new Error(`${name} is missing. Check your frontend .env file.`);
  }

  return url;
};

const replaceIdInUrl = (url, id) => {
  return url
    .replace("%7Bid%7D", encodeURIComponent(id))
    .replace("{id}", encodeURIComponent(id));
};

const normaliseMediaList = (data) => {
  if (Array.isArray(data?.Documents)) {
    return data.Documents;
  }

  if (Array.isArray(data?.documents)) {
    return data.documents;
  }

  if (Array.isArray(data?.media)) {
    return data.media;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
};

const getErrorMessage = async (response, fallbackMessage) => {
  try {
    const data = await response.json();

    return (
      data?.message ||
      data?.error ||
      data?.body?.message ||
      `${fallbackMessage} Status: ${response.status}`
    );
  } catch {
    return `${fallbackMessage} Status: ${response.status}`;
  }
};

export const getAllMedia = async () => {
  const url = validateLogicAppUrl(
    LOGIC_APP_URLS.getAll,
    "VITE_GET_ALL_MEDIA_URL"
  );

  const response = await fetch(url);

  if (!response.ok) {
    const message = await getErrorMessage(response, "Failed to fetch media.");
    throw new Error(message);
  }

  const data = await response.json();
  return normaliseMediaList(data);
};

export const getMediaById = async (id) => {
  const url = validateLogicAppUrl(
    LOGIC_APP_URLS.getById,
    "VITE_GET_MEDIA_BY_ID_URL"
  );

  const response = await fetch(replaceIdInUrl(url, id));

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to fetch media item."
    );
    throw new Error(message);
  }

  return response.json();
};

export const createMedia = async (mediaData) => {
  const url = validateLogicAppUrl(
    LOGIC_APP_URLS.create,
    "VITE_CREATE_MEDIA_URL"
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(mediaData)
  });

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to upload media."
    );
    throw new Error(message);
  }

  return response.json();
};

export const updateMedia = async (id, mediaData) => {
  const url = validateLogicAppUrl(
    LOGIC_APP_URLS.update,
    "VITE_UPDATE_MEDIA_URL"
  );

  const updateUrl =
    url.includes("%7Bid%7D") || url.includes("{id}")
      ? replaceIdInUrl(url, id)
      : url;

  const response = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...mediaData,
      id
    })
  });

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to update media."
    );
    throw new Error(message);
  }

  return response.json();
};

export const deleteMedia = async (id) => {
  const url = validateLogicAppUrl(
    LOGIC_APP_URLS.delete,
    "VITE_DELETE_MEDIA_URL"
  );

  const response = await fetch(replaceIdInUrl(url, id), {
    method: "DELETE"
  });

  if (!response.ok) {
    const message = await getErrorMessage(
      response,
      "Failed to delete media."
    );
    throw new Error(message);
  }

  return response.json();
};
# 🧠 Mentour Product & Knowledge API

A FastAPI-based multilingual product and Q&A platform. This API enables CRUD operations on multilingual products and contextual Q&A functionality for structured project data.

---



## 🔒 Authentication

This API uses a token-based authentication middleware to secure most endpoints. The `/ask_question` endpoint is currently exempt from this authentication.

To authenticate your requests, include a `Bearer` token in the `Authorization` header of your HTTP requests. The expected token is `Bearer mysecrettoken`.

### Example:

```
Authorization: Bearer mysecrettoken
```

If the token is missing or invalid, the API will return a `401 Unauthorized` response.

---



## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/MrJavlon4002/mentor.git
cd mentor
```

### 2. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the app

```bash
uvicorn app:app --reload
```

---



## 📚 API Documentation

Once running, access Swagger UI at:

`http://127.0.0.1:8000/docs`

## 📦 Endpoints




### 🔹 POST /products — Create Product

Create a multilingual product for a project. This endpoint requires authentication.

**Request Body:**

```json
{
  "details": { "id": "123", "name": "Test", "details": { "desc": "Example" } },
  "project_id": "example",
}
```




### 🔹 GET /products/{product_id} — Get Product Details

Retrieve a product. This endpoint requires authentication.

**Query Parameters:**

- `project_id`: string
- `product_id`: string




### 🔹 GET /products — List All Products

List all products of a project. This endpoint requires authentication.

**Query Parameters:**

- `project_id`: string




### 🔹 PUT /products/{product_id} — Update Product

Update product details. This endpoint requires authentication.

**Request Body:**

```json
{
  "project_id": "example",
  "product_id": "123",
  "details": {
    "id": "123",
    "name": "Updated Name",
    "details": { "desc": "New description" }
  }
}
```




### 🔹 DELETE /products/{product_id} — Delete Product

Remove a product in project. This endpoint requires authentication.

**Query Parameters:**

- `project_id`: string
- `product_id`: string




### 🔹 POST /ask_question — Ask Contextual Question

Ask questions using project context, history, and service type. This endpoint does **not** require authentication.

**Request Body:**

```json
{
  "project_id": "example",
  "project_name": "Example Project",
  "user_question": "What is this product about?",
  "history": [],
  "company_data": "Additional context …",
  "service_type": "support"
}
```

**Note:** `service_type` must be one of: `sales`, `support`, `staff`, `q/a`.




### 🔹 DELETE /delete_project — Delete Entire Project

Delete all data tied to a project. This endpoint requires authentication.

**Request Body:**

```json
{
  "project_id": "example",
}
```




### 🔹 POST /data_upload — Upload Raw Data

Upload raw or tabular project data for indexing. This endpoint requires authentication.

**Request Body:**

```json
{
  "project_id": "example",
  "row_data": "Some tabular data here",
}
```




### 🔹 POST /delete_all — Clear Entire Database

Wipe all stored data across every project. This endpoint requires authentication.

---



## 🧠 Notes

Question answering and translations use an LLM via `call_llm_with_functions`.
Data is stored under keys like `project_id` in the vector store.

---



## 📂 Project Structure

```
.
├── app.py                 # FastAPI application  
├── document_handler.py   # Core product & QA business logic  
├── data_prep/            # Data preparation utilities  
├── database/             # Vector database integrations  
├── general/              # LLM helper utilities  
├── Dockerfile  
├── docker-compose.yml  
├── nginx.conf  
├── requirements.txt  
└── README.md             # ← you’re here  
```

---



## 📫 Contact
Need help or want to collaborate? Reach me at:
valiyevjavlon001@gmail.com

import uuid
import weaviate
from weaviate.classes.config import Configure
import keys

class WeaviateDatabase:
    def __init__(self, host: str = "weaviate", port: int = 8080):
        self.headers = {"X-VoyageAI-Api-Key": keys.VOYAGE_API_KEY}
        self.host = host
        self.port = port

    def _create_client(self):
        return weaviate.connect_to_local(host=self.host, port=self.port, headers=self.headers,)

    # ------------- Admin ops -------------

    def delete_all_collections(self):
        with self._create_client() as client:
            client.collections.delete_all()

    def delete_project(self, project_id: str):
        with self._create_client() as client:
            if client.collections.exists(project_id):
                client.collections.delete(project_id)
                print(f"Collection '{project_id}' deleted.")
                return True
            print(f"Collection '{project_id}' does not exist.")
            return False

    def check_collection(self, project_id: str):
        with self._create_client() as client:
            exists = client.collections.exists(project_id)
            print(f"Collection '{project_id}' {'exists' if exists else 'does not exist'}.")
            return exists

    # ------------- Schema / init -------------

    def _ensure_collection_exists(self, client, project_id: str):
        if client.collections.exists(project_id):
            print(f"Collection '{project_id}' already exists.")
            return

        client.collections.create(
            project_id,
            vector_config=[
                Configure.Vectors.text2vec_voyageai(
                    name="text_vector",
                    source_properties=["title", "text", "name", "details"],
                    model="voyage-3",
                )
            ],
        )
        print(f"Collection '{project_id}' created with VoyageAI vectorizer over title/text/name/details.")

    def initialize_and_insert_data(self, row_data: dict, project_id: str):
        """
        row_data is expected like:
        {
          "id1": {"title": "...", "text": "..."},
          "id2": {"title": "...", "text": "..."},
          ...
        }
        """
        with self._create_client() as client:
            self._ensure_collection_exists(client, project_id)
            collection = client.collections.get(project_id)

            errors_before = None
            with collection.batch.dynamic() as batch:
                for _, doc in row_data.items():
                    title = doc.get("title", "") or ""
                    text = doc.get("text", "") or ""
                    batch.add_object(
                        properties={
                            "title": title,
                            "text": text,
                            "name": "",
                            "details": "",
                        }
                    )
                errors_before = batch.number_errors

            if errors_before and errors_before > 0:
                print(f"Inserted with {errors_before} errors into collection '{project_id}'.")
            else:
                print(f"Inserted data into collection '{project_id}'.")

    # ------------- Product CRUD -------------

    def add_product(self, project_id: str, details: dict):
        """
        details = {"id": "<uuid-optional>", "name": "...", "details": "..."}
        """
        with self._create_client() as client:
            if not client.collections.exists(project_id):
                print(f"Collection '{project_id}' does not exist.")
                return False

            collection = client.collections.get(project_id)
            try:
                pid = details.get("id") or str(uuid.uuid4())
                name = details.get("name", "") or ""
                info = details.get("details", "") or ""

                batch_errors = None
                with collection.batch.dynamic() as batch:
                    batch.add_object(
                        properties={
                            "name": name,
                            "details": info,
                            "title": "",
                            "text": f"{name}\n{info}".strip(),
                        },
                        uuid=pid,
                    )
                    batch_errors = batch.number_errors

                if batch_errors and batch_errors > 0:
                    print(f"Product added with {batch_errors} errors to '{project_id}'.")
                else:
                    print(f"Product added to collection '{project_id}'.")
                return True
            except Exception as e:
                print(f"Error adding product: {e}")
                return False

    def get_product(self, project_id: str, product_id: str):
        with self._create_client() as client:
            if not client.collections.exists(project_id):
                print(f"Collection '{project_id}' does not exist.")
                return None

            collection = client.collections.get(project_id)
            try:
                obj = collection.query.fetch_object_by_id(product_id)
                if obj and getattr(obj, "properties", None):
                    return obj.properties
                print(f"Product with ID '{product_id}' not found in collection '{project_id}'.")
                return None
            except Exception as e:
                print(f"Error retrieving product: {e}")
                return None

    def get_all_product(self, project_id: str):
        with self._create_client() as client:
            if not client.collections.exists(project_id):
                print(f"Collection '{project_id}' does not exist.")
                return None

            collection = client.collections.get(project_id)
            try:
                all_products = []
                for item in collection.iterator():
                    all_products.append(item.properties)
                return all_products
            except Exception as e:
                print(f"Error retrieving products: {e}")
                return None

    def update_product(self, project_id: str, details: dict):
        """
        details = {"id": "...", "name": "...", "details": "..."}
        """
        with self._create_client() as client:
            if not client.collections.exists(project_id):
                print(f"Collection '{project_id}' does not exist.")
                return False

            collection = client.collections.get(project_id)
            try:
                name = details.get("name", "") or ""
                info = details.get("details", "") or ""
                collection.data.update(
                    uuid=details["id"],
                    properties={
                        "name": name,
                        "details": info,
                        "text": f"{name}\n{info}".strip(),
                    },
                )
                print(f"Product with ID '{details['id']}' updated in collection '{project_id}'.")
                return True
            except Exception as e:
                print(f"Error updating product: {e}")
                return False

    def delete_product(self, project_id: str, product_id: str):
        with self._create_client() as client:
            if not client.collections.exists(project_id):
                print(f"Collection '{project_id}' does not exist.")
                return False

            collection = client.collections.get(project_id)
            try:
                collection.data.delete_by_id(product_id)
                print(f"Product with ID '{product_id}' deleted from collection '{project_id}'.")
                return True
            except Exception as e:
                print(f"Error deleting product: {e}")
                return False

    # ------------- Search -------------

    def hybrid_query(self, query: str | list, project_id: str, limit: int = 3, alpha: float = 0.25):
        client = None
        try:
            client = self._create_client()
            if not client.collections.exists(project_id):
                print(f"Collection '{project_id}' not found.")
                return []

            collection = client.collections.get(project_id)

            if isinstance(query, list):
                query = " ".join(q for q in query if q)

            print(query)
            response = collection.query.hybrid(
                query=query ,
                limit=limit,
                alpha=alpha,
                target_vector="text_vector"
            )

            out = []
            for obj in response.objects or []:
                props = getattr(obj, "properties", {}) or {}
                out.append(
                    {
                        "id": obj.uuid,
                        "title": props.get("title", ""),
                        "text": props.get("text", ""),
                        "name": props.get("name", ""),
                        "details": props.get("details", ""),
                    }
                )
            return out

        except Exception as e:
            print(f"Error during query: {e}")
            return []
        finally:
            if client:
                client.close()

import logging
from typing import Dict, Any, List, Optional, Union
import time

from faq.database.vector_database import WeaviateDatabase
from faq.data_prep.data_preparation import prepare_data

class DocumentHandler:
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.client = WeaviateDatabase()
        self.logger = logger or self._create_default_logger()

    def _create_default_logger(self) -> logging.Logger:
        logger = logging.getLogger(self.__class__.__name__)
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
        return logger

    async def data_upload(self, project_id: str, row_data: str) -> None:
        try:
            processed_data = await prepare_data(row_data)
            self.client.initialize_and_insert_data(processed_data, project_id=project_id)
            self.logger.info(f"Data inserted for project {project_id}")
        except Exception as e:
            self.logger.error(f"Upload failed: {e}")
            raise

    def create_product(self, details: Dict[str, Any], project_id: str) -> Dict[str, Any]:
        """
        Adds product data for a single project.
        """
        if 'details' not in details:
            raise ValueError("Missing 'details' in product details")

        product = {
            "name": details["name"],
            "details": details["details"],
            "id": details["id"],
        }
        try:
            self.client.add_product(f"{project_id}", product)
            self.logger.info(f"Product created for {project_id}")
        except Exception as e:
            self.logger.error(f"Product insert failed for {project_id}: {e}")
        return product

    def get_product(self, project_id: str, product_id: str) -> Union[Dict[str, Any], str]:
        """Get a single product from one specific collection."""
        try:
            product = self.client.get_product(project_id=f"{project_id}", product_id=product_id)
            if product:
                return product
        except Exception as e:
            self.logger.warning(f"Error getting product in {project_id}: {e}")

        return "Product not found"

    def get_all_products(self, project_id: str) -> Union[Any, str]:
        """Get all products for one specific collection."""
        try:
            product_list = self.client.get_all_product(project_id=f"{project_id}")
            if product_list:
                return product_list
        except Exception as e:
            self.logger.warning(f"Error getting products in {project_id}: {e}")

        return "Products not found"

    def update_product(self, project_id: str, details: Dict[str, Any]) -> None:
        """
        Updates a product for a single project.
        """
        updated = {
            "name": details["name"],
            "details": details["details"],
            "id": details["id"],
        }
        try:
            self.client.update_product(project_id=f"{project_id}", details=updated)
            self.logger.info(f"Product updated for {project_id}")
        except Exception as e:
            self.logger.error(f"Update failed for {project_id}: {e}")

    def delete_product(self, project_id: str, product_id: str) -> bool:
        try:
            self.client.delete_product(f"{project_id}", product_id)
            return True
        except Exception as e:
            self.logger.error(f"Delete failed for {project_id}: {e}")
            return False

    def query_core_data(self, project_id: str, query: str) -> Union[Any, str]:
        try:
            results = self.client.hybrid_query(query=query, project_id=f"{project_id}")
            return results
        except Exception as e:
            self.logger.error(f"Query error: {e}")
            return "Query failed"

    def delete_project(self, project_id: str) -> bool:
        try:
            self.client.delete_project(project_id=project_id)
            return True
        except Exception as e:
            self.logger.error(f"Project delete failed for {project_id}: {e}")
            return False

    def delete_all(self) -> bool:
        try:
            self.client.delete_all_collections()
            self.logger.info("All data deleted successfully.")
            return True
        except Exception as e:
            self.logger.error(f"Failed to delete all data: {e}")
            return False

    async def ask_question(self, question_details: Dict[str, Any]) -> Dict[str, Any]:
        start = time.time()
        required_keys = ["user_question", "project_id"]
        for key in required_keys:
            if key not in question_details:
                return {"error": f"Missing key: {key}"}

        try:
            context = [
                self.query_core_data(
                    query=question_details["user_question"],
                    project_id=question_details["project_id"]
                )
            ]

            return context

        except Exception as e:
            self.logger.error(f"QA failed: {e}")
            return {"error": str(e), "processing_time": time.time() - start}

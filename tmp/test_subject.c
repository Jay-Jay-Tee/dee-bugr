// tmp/test_subject.c
// Compile: gcc -g -O0 -o /tmp/test_lucid_c tmp/test_subject.c
// Debug with Lucid: select C/C++, set target to /tmp/test_lucid_c

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Node {
  int value;
  struct Node* next;
} Node;

Node* create_node(int value) {
  Node* n = (Node*)malloc(sizeof(Node));
  n->value = value;
  n->next = NULL;
  return n;
}

int sum_list(Node* head) {
  int total = 0;
  Node* curr = head;
  while (curr != NULL) {
    total += curr->value;
    curr = curr->next;
  }
  return total;
}

int main() {
  // Build a linked list: 1 -> 2 -> 3 -> NULL
  Node* head = create_node(1);
  head->next = create_node(2);
  head->next->next = create_node(3);

  int result = sum_list(head);
  printf("Sum: %d\n", result);  // Expected: 6

  // Intentional null pointer bug — good for demo
  Node* bad = NULL;
  // bad->value = 42;  // uncomment to trigger crash at this line

  // Free list
  Node* curr = head;
  while (curr != NULL) {
    Node* tmp = curr;
    curr = curr->next;
    free(tmp);
  }

  printf("Done.\n");
  return 0;
}
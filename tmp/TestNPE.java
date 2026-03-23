/**
 * tmp/TestNPE.java
 * Day 7 Java test subject — NullPointerException on node traversal.
 *
 * Compile:  javac -g tmp/TestNPE.java -d tmp/
 * Run with JDWP:
 *   java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:5005 \
 *        -cp tmp TestNPE
 */
public class TestNPE {

    static class Node {
        int value;
        Node next;

        Node(int value) {
            this.value = value;
            this.next = null;
        }
    }

    static int sumList(Node head) {
        int total = 0;
        // BUG: no null check — crashes when head is null or list ends early
        while (head != null) {
            total += head.value;
            head = head.next;
        }
        return total;
    }

    static Node buildList(int... values) {
        if (values.length == 0) return null;
        Node head = new Node(values[0]);
        Node cur = head;
        for (int i = 1; i < values.length; i++) {
            cur.next = new Node(values[i]);
            cur = cur.next;
        }
        return head;
    }

    public static void main(String[] args) {
        Node list = buildList(10, 20, 30);
        int sum = sumList(list);
        System.out.println("Sum: " + sum);  // breakpoint here

        // This triggers the NPE scenario — passing null
        Node empty = null;
        int badSum = sumList(empty.next);  // NPE: null.next
        System.out.println("Bad sum: " + badSum);
    }
}
